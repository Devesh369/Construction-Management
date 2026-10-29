import json
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse

from .models import LocationCostIndex, CostEstimate, format_indian_currency
from .forms import CostEstimateForm, MARGIN_OPTIONS
from .services import CostEstimatorService

User = get_user_model()


class CostEstimateFormTests(TestCase):
    """
    Tests for CostEstimateForm validation, default margin choices,
    and custom margin boundaries (0% to 100%).
    """
    def setUp(self):
        self.valid_base_data = {
            'project_name': 'Greenwood Villa Phase 1',
            'project_type': 'VILLA',
            'construction_type': 'NEW',
            'state': 'Gujarat',
            'city': 'Anand',
            'area_type': 'TIER_2',
            'plot_area_sqft': Decimal('3000.00'),
            'builtup_area_per_floor_sqft': Decimal('1500.00'),
            'number_of_floors': 2,
            'total_builtup_area': Decimal('3000.00'),
            'number_of_units': 1,
            'parking_type': 'OPEN',
            'structure_type': 'RCC_FRAME',
            'foundation_type': 'ISOLATED',
            'wall_material': 'RED_BRICK',
            'roof_type': 'RCC_SLAB',
            'quality_level': 'PREMIUM',
            'contract_type': 'TURNKEY',
            'expected_duration_months': 14,
            'contingency_percent': Decimal('5.00'),
            'margin_option': '13.00',
        }

    def test_valid_preset_margin(self):
        form = CostEstimateForm(data=self.valid_base_data)
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data['margin_percent'], Decimal('13.00'))

    def test_valid_custom_margin(self):
        data = self.valid_base_data.copy()
        data['margin_option'] = 'custom'
        data['custom_margin_value'] = '15.5'
        form = CostEstimateForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data['margin_percent'], Decimal('15.5'))

    def test_custom_margin_missing_value_invalid(self):
        data = self.valid_base_data.copy()
        data['margin_option'] = 'custom'
        data['custom_margin_value'] = ''
        form = CostEstimateForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn('custom_margin_value', form.errors)

    def test_custom_margin_out_of_bounds_invalid(self):
        # Negative margin
        data = self.valid_base_data.copy()
        data['margin_option'] = 'custom'
        data['custom_margin_value'] = '-2.5'
        form = CostEstimateForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn('custom_margin_value', form.errors)

        # Margin greater than 100%
        data['custom_margin_value'] = '105.0'
        form = CostEstimateForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn('custom_margin_value', form.errors)

    def test_auto_calculates_total_builtup_area_if_missing(self):
        data = self.valid_base_data.copy()
        data['total_builtup_area'] = ''
        data['builtup_area_per_floor_sqft'] = '1200'
        data['number_of_floors'] = 3
        form = CostEstimateForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data['total_builtup_area'], Decimal('3600'))


class CostEstimatorServiceTests(TestCase):
    """
    Unit tests for Python margin math, JSON parser sanitization,
    deterministic fallback generation, and Anthropic mocking.
    """
    def setUp(self):
        self.user = User.objects.create_user(
            username='contractor1',
            email='contractor@buildsphere.com',
            password='TestPassword123!'
        )
        self.city_idx = LocationCostIndex.objects.create(
            city='Anand',
            state='Gujarat',
            area_type='TIER_2',
            base_rate_economy=Decimal('1400.00'),
            base_rate_standard=Decimal('1750.00'),
            base_rate_premium=Decimal('2300.00'),
            base_rate_luxury=Decimal('3100.00'),
            material_index=Decimal('1.00'),
            labour_index=Decimal('0.95'),
        )

    def test_python_margin_math_recomputation(self):
        service = CostEstimatorService()
        sample_breakdown = [
            {'category': 'Structure (RCC/steel)', 'amount': 2000000},
            {'category': 'Foundation', 'amount': 1000000},
            {'category': 'Masonry', 'amount': 1000000},
        ]
        # Total subtotal = 40,00,000
        # Contingency = 5% = 2,00,000
        # Margin = 13% = 5,20,000
        # GST = (40,00,000 + 2,00,000) * 18% = 42,00,000 * 0.18 = 7,56,000
        # Grand total = 40,00,000 + 2,00,000 + 5,20,000 + 7,56,000 = 54,76,000
        # Cost per sqft for 2000 sq ft = 54,76,000 / 2000 = 2738.00
        totals = service.recompute_totals(
            breakdown=sample_breakdown,
            built_up_area=2000,
            contingency_percent=Decimal('5.0'),
            margin_percent=Decimal('13.0')
        )
        self.assertEqual(totals['subtotal'], Decimal('4000000.00'))
        self.assertEqual(totals['contingency_amount'], Decimal('200000.00'))
        self.assertEqual(totals['margin_amount'], Decimal('520000.00'))
        self.assertEqual(totals['gst_or_taxes'], Decimal('756000.00'))
        self.assertEqual(totals['grand_total'], Decimal('5476000.00'))
        self.assertEqual(totals['cost_per_sqft'], Decimal('2738.00'))

    def test_json_cleaner_and_parser(self):
        service = CostEstimatorService()
        # Simulated raw output from LLM wrapped in markdown fences
        raw_output = """
        ```json
        {
          "currency": "INR",
          "base_rate_per_sqft": 1850,
          "breakdown": [
            {"category": "Structure (RCC/steel)", "amount": 1500000, "percentage": 30.0, "notes": "Fe550 rebar"}
          ],
          "assumptions": ["Level ground"],
          "risks": ["Monsoon delay"]
        }
        ```
        """
        parsed = service._clean_and_parse_json(raw_output)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed['currency'], 'INR')
        self.assertEqual(len(parsed['breakdown']), 1)
        self.assertEqual(parsed['breakdown'][0]['amount'], 1500000)

    def test_fallback_when_api_key_absent(self):
        # Service initialized with empty API key
        service = CostEstimatorService()
        service.api_key = ''
        
        estimate_data = {
            'project_name': 'Anand Commercial Hub',
            'project_type': 'COMMERCIAL',
            'construction_type': 'NEW',
            'city': 'Anand',
            'state': 'Gujarat',
            'quality_level': 'STANDARD',
            'total_builtup_area': Decimal('4000.00'),
            'margin_percent': Decimal('9.00'),
            'contingency_percent': Decimal('5.00'),
            'expected_duration_months': 12,
        }

        estimate = service.calculate_estimate(estimate_data, owner=self.user)
        self.assertTrue(estimate.used_fallback)
        self.assertGreater(estimate.grand_total, Decimal('0.00'))
        self.assertGreater(estimate.cost_per_sqft, Decimal('0.00'))
        self.assertEqual(estimate.margin_percent, Decimal('9.00'))
        self.assertIn('breakdown', estimate.result_json)
        self.assertGreater(len(estimate.result_json['breakdown']), 10)

    @patch('anthropic.Anthropic')
    def test_successful_api_mock_calculation(self, mock_anthropic_class):
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=json.dumps({
            "currency": "INR",
            "base_rate_per_sqft": 2000,
            "location_factor": 1.05,
            "total_built_up_area": 3000,
            "breakdown": [
                {"category": "Structure (RCC/steel)", "amount": 2500000, "percentage": 35.0, "notes": "M25 concrete"},
                {"category": "Foundation", "amount": 1000000, "percentage": 15.0, "notes": "Isolated pad footings"}
            ],
            "estimated_duration_months": 10,
            "confidence": "high",
            "assumptions": ["Dry season start"],
            "risks": ["Material logistics"]
        }))]
        mock_client.messages.create.return_value = mock_response

        service = CostEstimatorService()
        service.api_key = 'test-key-mock'

        estimate_data = {
            'project_name': 'Mock Villa',
            'project_type': 'VILLA',
            'construction_type': 'NEW',
            'city': 'Anand',
            'state': 'Gujarat',
            'quality_level': 'STANDARD',
            'total_builtup_area': Decimal('3000.00'),
            'margin_percent': Decimal('13.00'),
            'contingency_percent': Decimal('5.00'),
        }

        estimate = service.calculate_estimate(estimate_data, owner=self.user)
        self.assertFalse(estimate.used_fallback)
        self.assertEqual(estimate.margin_percent, Decimal('13.00'))
        # Subtotal: 25L + 10L = 35L
        self.assertEqual(estimate.subtotal, Decimal('3500000.00'))
        self.assertEqual(estimate.contingency_amount, Decimal('175000.00')) # 5% of 35L
        self.assertEqual(estimate.margin_amount, Decimal('455000.00')) # 13% of 35L


class ViewPermissionAndWorkflowTests(TestCase):
    """
    Tests for view access controls, user isolation, and recalculation endpoints.
    """
    def setUp(self):
        self.client = Client()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@buildsphere.com',
            password='Password123!'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@buildsphere.com',
            password='Password123!'
        )
        self.estimate1 = CostEstimate.objects.create(
            owner=self.user1,
            project_name='User1 Apartment',
            city='Ahmedabad',
            state='Gujarat',
            plot_area_sqft=Decimal('2000'),
            builtup_area_per_floor_sqft=Decimal('1000'),
            number_of_floors=2,
            total_builtup_area=Decimal('2000'),
            margin_percent=Decimal('13.00'),
            subtotal=Decimal('3000000.00'),
            contingency_amount=Decimal('150000.00'),
            margin_amount=Decimal('390000.00'),
            gst_or_taxes=Decimal('567000.00'),
            grand_total=Decimal('4107000.00'),
            cost_per_sqft=Decimal('2053.50'),
            result_json={'breakdown': [{'category': 'Structure (RCC/steel)', 'amount': 3000000}]}
        )

    def test_anonymous_redirected_to_login(self):
        res = self.client.get(reverse('cost_estimator:create'))
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login/', res.url)

    def test_user_cannot_access_other_users_estimate(self):
        self.client.login(username='user2', password='Password123!')
        res = self.client.get(reverse('cost_estimator:result', kwargs={'pk': self.estimate1.pk}))
        # User 2 should get a 404 because estimate belongs to User 1
        self.assertEqual(res.status_code, 404)

    def test_owner_can_access_estimate(self):
        self.client.login(username='user1', password='Password123!')
        res = self.client.get(reverse('cost_estimator:result', kwargs={'pk': self.estimate1.pk}))
        self.assertEqual(res.status_code, 200)

    def test_recalculate_margin_recomputes_in_python(self):
        self.client.login(username='user1', password='Password123!')
        res = self.client.post(
            reverse('cost_estimator:recalculate', kwargs={'pk': self.estimate1.pk}),
            {'margin_percent': '20.00'}
        )
        self.assertEqual(res.status_code, 302)
        self.estimate1.refresh_from_db()
        self.assertEqual(self.estimate1.margin_percent, Decimal('20.00'))
        # Subtotal is 30,00,000 -> 20% margin is 6,00,000
        self.assertEqual(self.estimate1.margin_amount, Decimal('600000.00'))


class CurrencyFormattingTests(TestCase):
    def test_indian_rupee_formatting(self):
        self.assertEqual(format_indian_currency(100), "₹ 100")
        self.assertEqual(format_indian_currency(1000), "₹ 1,000")
        self.assertEqual(format_indian_currency(1250000), "₹ 12,50,000")
        self.assertEqual(format_indian_currency(10000000), "₹ 1,00,00,000")
        self.assertEqual(format_indian_currency(-50000), "-₹ 50,000")
