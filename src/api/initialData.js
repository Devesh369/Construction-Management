// Initial seed database exported from Django data_backup.json
export const INITIAL_DB = {
  "organizations": [
    {
      "name": "BuildSphere org.",
      "address": "",
      "contact_email": "devesh@buildsphere.com",
      "contact_phone": "",
      "logo": "",
      "currency": "INR",
      "workday_hours": "8.00",
      "half_day_hours": "4.00",
      "overtime_after_hours": "8.00",
      "expense_approval_limit": "1000.00",
      "is_active": true,
      "created_at": "2026-10-22T18:05:30.901Z",
      "updated_at": "2026-10-22T18:05:30.901Z",
      "id": 10
    }
  ],
  "users": [
    {
      "id": 1,
      "email": "devesh@buildsphere.com",
      "name": "Devesh Patel",
      "role": "ORG_ADMIN",
      "phone": "+91 98765 43210",
      "is_active": true,
      "organization": 10
    },
    {
      "id": 2,
      "email": "darshil@buildsphere.com",
      "name": "Darshil Gajera",
      "role": "PROJECT_MANAGER",
      "phone": "9878789878",
      "is_active": true,
      "organization": 10
    },
    {
      "id": 3,
      "email": "viren@buildsphere.com",
      "name": "Viren Prajapati",
      "role": "SITE_ENGINEER",
      "phone": "+91 98765 12345",
      "is_active": true,
      "organization": 10
    },
    {
      "id": 4,
      "email": "san@gmail.com",
      "name": "sanklp",
      "role": "ACCOUNTANT",
      "phone": "9327941898",
      "is_active": true,
      "organization": 10
    }
  ],
  "projects": [
    {
      "organization": 10,
      "created_at": "2026-10-22T19:08:27.526Z",
      "updated_at": "2026-10-22T19:08:27.526Z",
      "deleted_at": null,
      "name": "Farm House",
      "code": "PRJ-FARMH",
      "client_name": "Devesh Patel",
      "client_phone": "7896898569",
      "location": "Anand",
      "description": "ABCD",
      "status": "ACTIVE",
      "start_date": null,
      "expected_end_date": null,
      "estimated_budget": "0.00",
      "actual_spend": "0.00",
      "progress_percent": "0.00",
      "id": 29
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:34:14.732Z",
      "updated_at": "2026-10-23T04:34:14.732Z",
      "deleted_at": null,
      "name": "Shivani Bunglow",
      "code": "SB-001",
      "client_name": "Nek Patel",
      "client_phone": "9437898756",
      "location": "MANJALPUR",
      "description": "Deadline is December 2028",
      "status": "ACTIVE",
      "start_date": null,
      "expected_end_date": null,
      "estimated_budget": "20000000.00",
      "actual_spend": "0.00",
      "progress_percent": "0.00",
      "id": 30
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:20:04.308Z",
      "updated_at": "2026-10-23T16:20:04.308Z",
      "deleted_at": null,
      "name": "Sky Avenue",
      "code": "SA-003",
      "client_name": "Vijay Sinha",
      "client_phone": "9898767656",
      "location": "ANAND",
      "description": "We are alrady Delayed",
      "status": "ACTIVE",
      "start_date": null,
      "expected_end_date": null,
      "estimated_budget": "30000000.00",
      "actual_spend": "0.00",
      "progress_percent": "0.00",
      "id": 31
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:11:25.458Z",
      "updated_at": "2026-10-24T03:11:25.458Z",
      "deleted_at": null,
      "name": "One line Avenue",
      "code": "OL004",
      "client_name": "Jangan mohan reddy",
      "client_phone": "7866675686",
      "location": "Ahmdabad",
      "description": "Just Launched",
      "status": "ACTIVE",
      "start_date": null,
      "expected_end_date": null,
      "estimated_budget": "69999999.00",
      "actual_spend": "1000.00",
      "progress_percent": "0.00",
      "id": 32
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:38:54.719Z",
      "updated_at": "2026-10-28T12:38:54.719Z",
      "deleted_at": null,
      "name": "Ashopalav House",
      "code": "ASH-008",
      "client_name": "Ashopaval pvt. ltd.",
      "client_phone": "9999993648",
      "location": "AHMDABAD",
      "description": "Start working from next Monday",
      "status": "ACTIVE",
      "start_date": null,
      "expected_end_date": null,
      "estimated_budget": "45000000.00",
      "actual_spend": "0.00",
      "progress_percent": "0.00",
      "id": 33
    }
  ],
  "project_memberships": [
    {
      "organization": 10,
      "created_at": "2026-10-22T19:08:27.528Z",
      "updated_at": "2026-10-22T19:08:27.528Z",
      "deleted_at": null,
      "project": 29,
      "user": [
        "devesh@buildsphere.com"
      ],
      "site_role": "Project Lead",
      "id": 34
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:34:14.734Z",
      "updated_at": "2026-10-23T04:34:14.734Z",
      "deleted_at": null,
      "project": 30,
      "user": [
        "devesh@buildsphere.com"
      ],
      "site_role": "Project Lead",
      "id": 35
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:20:04.313Z",
      "updated_at": "2026-10-23T16:20:04.313Z",
      "deleted_at": null,
      "project": 31,
      "user": [
        "devesh@buildsphere.com"
      ],
      "site_role": "Project Lead",
      "id": 36
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:11:25.460Z",
      "updated_at": "2026-10-24T03:11:25.460Z",
      "deleted_at": null,
      "project": 32,
      "user": [
        "darshil@buildsphere.com"
      ],
      "site_role": "Project Lead",
      "id": 37
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:38:54.722Z",
      "updated_at": "2026-10-28T12:38:54.722Z",
      "deleted_at": null,
      "project": 33,
      "user": [
        "devesh@buildsphere.com"
      ],
      "site_role": "Project Lead",
      "id": 38
    }
  ],
  "budget_categories": [
    {
      "organization": 10,
      "created_at": "2026-10-22T19:08:27.530Z",
      "updated_at": "2026-10-22T19:08:27.530Z",
      "deleted_at": null,
      "project": 29,
      "name": "LABOR",
      "allocated_amount": "0.00",
      "id": 97
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T19:08:27.531Z",
      "updated_at": "2026-10-22T19:08:27.531Z",
      "deleted_at": null,
      "project": 29,
      "name": "MATERIALS",
      "allocated_amount": "0.00",
      "id": 98
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T19:08:27.531Z",
      "updated_at": "2026-10-22T19:08:27.531Z",
      "deleted_at": null,
      "project": 29,
      "name": "EQUIPMENT",
      "allocated_amount": "0.00",
      "id": 99
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T19:08:27.532Z",
      "updated_at": "2026-10-22T19:08:27.532Z",
      "deleted_at": null,
      "project": 29,
      "name": "OVERHEAD",
      "allocated_amount": "0.00",
      "id": 100
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:34:14.735Z",
      "updated_at": "2026-10-23T04:34:14.735Z",
      "deleted_at": null,
      "project": 30,
      "name": "LABOR",
      "allocated_amount": "0.00",
      "id": 101
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:34:14.736Z",
      "updated_at": "2026-10-23T04:34:14.736Z",
      "deleted_at": null,
      "project": 30,
      "name": "MATERIALS",
      "allocated_amount": "0.00",
      "id": 102
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:34:14.736Z",
      "updated_at": "2026-10-23T04:34:14.736Z",
      "deleted_at": null,
      "project": 30,
      "name": "EQUIPMENT",
      "allocated_amount": "0.00",
      "id": 103
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:34:14.737Z",
      "updated_at": "2026-10-23T04:34:14.737Z",
      "deleted_at": null,
      "project": 30,
      "name": "OVERHEAD",
      "allocated_amount": "0.00",
      "id": 104
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:20:04.315Z",
      "updated_at": "2026-10-23T16:20:04.315Z",
      "deleted_at": null,
      "project": 31,
      "name": "LABOR",
      "allocated_amount": "0.00",
      "id": 105
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:20:04.317Z",
      "updated_at": "2026-10-23T16:20:04.317Z",
      "deleted_at": null,
      "project": 31,
      "name": "MATERIALS",
      "allocated_amount": "0.00",
      "id": 106
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:20:04.318Z",
      "updated_at": "2026-10-23T16:20:04.318Z",
      "deleted_at": null,
      "project": 31,
      "name": "EQUIPMENT",
      "allocated_amount": "0.00",
      "id": 107
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:20:04.319Z",
      "updated_at": "2026-10-23T16:20:04.319Z",
      "deleted_at": null,
      "project": 31,
      "name": "OVERHEAD",
      "allocated_amount": "0.00",
      "id": 108
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:11:25.461Z",
      "updated_at": "2026-10-24T03:11:25.461Z",
      "deleted_at": null,
      "project": 32,
      "name": "LABOR",
      "allocated_amount": "0.00",
      "id": 109
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:11:25.463Z",
      "updated_at": "2026-10-24T03:11:25.463Z",
      "deleted_at": null,
      "project": 32,
      "name": "MATERIALS",
      "allocated_amount": "0.00",
      "id": 110
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:11:25.463Z",
      "updated_at": "2026-10-24T03:11:25.464Z",
      "deleted_at": null,
      "project": 32,
      "name": "EQUIPMENT",
      "allocated_amount": "0.00",
      "id": 111
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:11:25.464Z",
      "updated_at": "2026-10-24T03:11:25.464Z",
      "deleted_at": null,
      "project": 32,
      "name": "OVERHEAD",
      "allocated_amount": "0.00",
      "id": 112
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:38:54.723Z",
      "updated_at": "2026-10-28T12:38:54.723Z",
      "deleted_at": null,
      "project": 33,
      "name": "LABOR",
      "allocated_amount": "0.00",
      "id": 113
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:38:54.726Z",
      "updated_at": "2026-10-28T12:38:54.726Z",
      "deleted_at": null,
      "project": 33,
      "name": "MATERIALS",
      "allocated_amount": "0.00",
      "id": 114
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:38:54.727Z",
      "updated_at": "2026-10-28T12:38:54.727Z",
      "deleted_at": null,
      "project": 33,
      "name": "EQUIPMENT",
      "allocated_amount": "0.00",
      "id": 115
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:38:54.728Z",
      "updated_at": "2026-10-28T12:38:54.728Z",
      "deleted_at": null,
      "project": 33,
      "name": "OVERHEAD",
      "allocated_amount": "0.00",
      "id": 116
    }
  ],
  "employees": [
    {
      "organization": 10,
      "created_at": "2026-10-22T19:09:44.601Z",
      "updated_at": "2026-10-22T19:09:44.601Z",
      "deleted_at": null,
      "employee_code": "EMP-0001",
      "full_name": "Darshil",
      "phone": "7858968985",
      "joining_date": "2026-10-22",
      "is_active": true,
      "trade": "KARIGAR",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "800.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": 29,
      "group": null,
      "email": "",
      "role": "Karigar",
      "address": "Surat",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [
        29
      ],
      "id": 100
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:48:53.013Z",
      "updated_at": "2026-10-23T04:48:53.013Z",
      "deleted_at": null,
      "employee_code": "EMP-0002",
      "full_name": "Sankalp Bhoi",
      "phone": "9327941898",
      "joining_date": "2026-10-23",
      "is_active": true,
      "trade": "PAINTER",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "550.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": 33,
      "group": null,
      "email": "",
      "role": "Painter",
      "address": "Bakrol",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [
        33
      ],
      "id": 101
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:49:39.915Z",
      "updated_at": "2026-10-23T04:49:39.915Z",
      "deleted_at": null,
      "employee_code": "EMP-0003",
      "full_name": "Viren Prajapati",
      "phone": "1234568782",
      "joining_date": "2026-10-23",
      "is_active": true,
      "trade": "HELPER",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "300.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": 30,
      "group": null,
      "email": "",
      "role": "Helper",
      "address": "ANAND",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [
        30
      ],
      "id": 102
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:50:14.826Z",
      "updated_at": "2026-10-23T04:50:28.939Z",
      "deleted_at": null,
      "employee_code": "EMP-0004",
      "full_name": "Param Darji",
      "phone": "9867775898",
      "joining_date": "2026-10-23",
      "is_active": true,
      "trade": "LABOUR",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "300.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": 29,
      "group": null,
      "email": "",
      "role": "Labour",
      "address": "Mogri",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [
        29
      ],
      "id": 103
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:21:31.662Z",
      "updated_at": "2026-10-23T16:21:31.662Z",
      "deleted_at": null,
      "employee_code": "EMP-0005",
      "full_name": "Raviraj chauhan",
      "phone": "2340989878",
      "joining_date": "2026-10-21",
      "is_active": true,
      "trade": "HELPER",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "250.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": 31,
      "group": null,
      "email": "rv@gmail.com",
      "role": "Helper",
      "address": "Jamnagar",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [
        31
      ],
      "id": 104
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:34:36.503Z",
      "updated_at": "2026-10-23T16:34:36.503Z",
      "deleted_at": null,
      "employee_code": "EMP-0006",
      "full_name": "Dish Patel",
      "phone": "9327941898",
      "joining_date": "2026-10-23",
      "is_active": true,
      "trade": "WELDER",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "700.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": 30,
      "group": null,
      "email": "pateldevesh369@gmail.com",
      "role": "Welder",
      "address": "125 , MOTU FALIYA",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [
        32,
        30
      ],
      "id": 105
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:39:40.277Z",
      "updated_at": "2026-10-28T12:39:40.277Z",
      "deleted_at": null,
      "employee_code": "EMP-0007",
      "full_name": "Rudra Patel",
      "phone": "9327941800",
      "joining_date": "2026-10-28",
      "is_active": true,
      "trade": "ELECTRICIAN",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "550.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": 33,
      "group": null,
      "email": "",
      "role": "Electrician",
      "address": "jambusar",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [
        33
      ],
      "id": 106
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:40:06.719Z",
      "updated_at": "2026-10-28T12:40:06.719Z",
      "deleted_at": null,
      "employee_code": "EMP-0008",
      "full_name": "Jay",
      "phone": "2223443133",
      "joining_date": "2026-10-28",
      "is_active": true,
      "trade": "ELECTRICIAN",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "600.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": null,
      "group": null,
      "email": "",
      "role": "Electrician",
      "address": "",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [],
      "id": 107
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:40:27.107Z",
      "updated_at": "2026-10-28T12:40:27.107Z",
      "deleted_at": null,
      "employee_code": "EMP-0009",
      "full_name": "Vikram Rathod",
      "phone": "3232323232",
      "joining_date": "2026-10-28",
      "is_active": true,
      "trade": "ELECTRICIAN",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "800.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": null,
      "group": null,
      "email": "",
      "role": "Electrician",
      "address": "",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [],
      "id": 108
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:40:54.750Z",
      "updated_at": "2026-10-28T12:40:54.750Z",
      "deleted_at": null,
      "employee_code": "EMP-0010",
      "full_name": "Ayush Mistry",
      "phone": "2345644322",
      "joining_date": "2026-10-28",
      "is_active": true,
      "trade": "CARPENTER",
      "skill_level": "UNSKILLED",
      "employment_type": "DAILY_WAGE",
      "daily_rate": "600.00",
      "ot_hourly_rate": "0.00",
      "monthly_salary": "0.00",
      "bank_account_name": "",
      "bank_account_number": "",
      "bank_ifsc": "",
      "upi_id": "",
      "id_proof_type": "AADHAAR",
      "id_proof_number": "",
      "primary_project": 33,
      "group": null,
      "email": "",
      "role": "Carpenter",
      "address": "",
      "emergency_contact": "",
      "bank_name": "",
      "assigned_projects": [
        33
      ],
      "id": 109
    }
  ],
  "attendances": [
    {
      "organization": 10,
      "created_at": "2026-10-22T19:10:40.545Z",
      "updated_at": "2026-10-22T19:10:40.545Z",
      "deleted_at": null,
      "employee": 100,
      "project": 29,
      "date": "2026-10-22",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": true,
      "settled_at": "2026-10-22T19:13:17.751Z",
      "settled_amount": "500.00",
      "settled_by_payment_id": "11",
      "id": 917
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:44:17.248Z",
      "updated_at": "2026-10-23T04:44:17.248Z",
      "deleted_at": null,
      "employee": 100,
      "project": 29,
      "date": "2026-10-23",
      "status": "HALF_DAY",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 918
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:44:28.282Z",
      "updated_at": "2026-10-23T04:44:28.282Z",
      "deleted_at": null,
      "employee": 100,
      "project": 29,
      "date": "2026-10-14",
      "status": "ABSENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 919
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T08:08:46.476Z",
      "updated_at": "2026-10-23T08:08:46.476Z",
      "deleted_at": null,
      "employee": 102,
      "project": 30,
      "date": "2026-10-23",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 920
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:22:55.269Z",
      "updated_at": "2026-10-23T16:22:55.269Z",
      "deleted_at": null,
      "employee": 104,
      "project": 31,
      "date": "2026-10-23",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": true,
      "settled_at": "2026-10-23T16:30:07.227Z",
      "settled_amount": "250.00",
      "settled_by_payment_id": "12",
      "id": 921
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:12:16.142Z",
      "updated_at": "2026-10-24T03:12:16.142Z",
      "deleted_at": null,
      "employee": 105,
      "project": 32,
      "date": "2026-10-24",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "darshil@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 922
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T04:15:44.114Z",
      "updated_at": "2026-10-28T04:15:44.114Z",
      "deleted_at": null,
      "employee": 105,
      "project": 30,
      "date": "2026-10-28",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 923
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T04:15:44.121Z",
      "updated_at": "2026-10-28T04:15:44.121Z",
      "deleted_at": null,
      "employee": 100,
      "project": 29,
      "date": "2026-10-28",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 924
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:36:53.298Z",
      "updated_at": "2026-10-28T12:36:53.298Z",
      "deleted_at": null,
      "employee": 104,
      "project": 31,
      "date": "2026-10-28",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 925
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:41:46.019Z",
      "updated_at": "2026-10-28T12:41:46.019Z",
      "deleted_at": null,
      "employee": 109,
      "project": 33,
      "date": "2026-10-28",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 926
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:41:46.023Z",
      "updated_at": "2026-10-28T12:41:46.023Z",
      "deleted_at": null,
      "employee": 106,
      "project": 33,
      "date": "2026-10-28",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 927
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:41:46.025Z",
      "updated_at": "2026-10-28T12:41:46.026Z",
      "deleted_at": null,
      "employee": 101,
      "project": 33,
      "date": "2026-10-28",
      "status": "PRESENT",
      "check_in_time": null,
      "check_out_time": null,
      "worked_hours": null,
      "ot_hours": "0.00",
      "remarks": "",
      "marked_by": [
        "devesh@buildsphere.com"
      ],
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "is_settled": false,
      "settled_at": null,
      "settled_amount": "0.00",
      "settled_by_payment_id": null,
      "id": 928
    }
  ],
  "holidays": [
    {
      "organization": 10,
      "created_at": "2026-10-23T04:47:37.096Z",
      "updated_at": "2026-10-23T04:47:37.096Z",
      "deleted_at": null,
      "project": null,
      "date": "2026-10-25",
      "name": "Happy Weekend !",
      "holiday_type": "NATIONAL",
      "is_paid": true,
      "id": 4
    }
  ],
  "work_entries": [
    {
      "organization": 10,
      "deleted_at": "2026-10-22T19:12:44.326Z",
      "project": 29,
      "date": "2026-10-22",
      "description": "Plaster work",
      "department": "",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "created_at": "2026-10-22T19:12:09.570Z",
      "updated_at": "2026-10-22T19:12:44.326Z",
      "employees": [
        100
      ],
      "id": 13
    },
    {
      "organization": 10,
      "deleted_at": null,
      "project": 30,
      "date": "2026-10-23",
      "description": "Urget need.",
      "department": "",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "created_at": "2026-10-23T16:24:18.072Z",
      "updated_at": "2026-10-23T16:24:18.072Z",
      "employees": [
        102
      ],
      "id": 14
    },
    {
      "organization": 10,
      "deleted_at": null,
      "project": 32,
      "date": "2026-10-24",
      "description": "working well",
      "department": "",
      "created_by": [
        "darshil@buildsphere.com"
      ],
      "created_at": "2026-10-24T03:12:48.811Z",
      "updated_at": "2026-10-24T03:12:48.811Z",
      "employees": [
        105
      ],
      "id": 15
    },
    {
      "organization": 10,
      "deleted_at": null,
      "project": 30,
      "date": "2026-10-28",
      "description": "Make Outer door and install it.",
      "department": "",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "created_at": "2026-10-28T04:16:35.768Z",
      "updated_at": "2026-10-28T04:16:35.768Z",
      "employees": [
        105
      ],
      "id": 16
    },
    {
      "organization": 10,
      "deleted_at": null,
      "project": 31,
      "date": "2026-10-28",
      "description": "sazc",
      "department": "",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "created_at": "2026-10-28T12:37:21.124Z",
      "updated_at": "2026-10-28T12:37:21.125Z",
      "employees": [
        104
      ],
      "id": 17
    },
    {
      "organization": 10,
      "deleted_at": null,
      "project": 33,
      "date": "2026-10-28",
      "description": "All are working on their task and will be completed by 1/10/26",
      "department": "",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "created_at": "2026-10-28T12:42:28.464Z",
      "updated_at": "2026-10-28T12:42:28.464Z",
      "employees": [
        109,
        106,
        101
      ],
      "id": 18
    }
  ],
  "expenses": [
    {
      "organization": 10,
      "created_at": "2026-10-23T16:54:18.402Z",
      "updated_at": "2026-10-23T16:54:18.402Z",
      "deleted_at": null,
      "project": 30,
      "vendor": null,
      "category": "EQUIPMENT_RENTAL",
      "description": "welding machine",
      "amount": "39000.00",
      "expense_date": "2026-10-23",
      "payment_mode": "CASH",
      "invoice_number": "",
      "due_date": null,
      "receipt": "receipts/Profit_and_Loss.pdf",
      "is_recurring": false,
      "details": {},
      "status": "PENDING_APPROVAL",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "approved_by": null,
      "approved_at": null,
      "rejection_reason": "",
      "cancel_reason": "",
      "journal_entry": null,
      "id": 52
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:13:22.324Z",
      "updated_at": "2026-10-24T03:13:22.324Z",
      "deleted_at": null,
      "project": 32,
      "vendor": null,
      "category": "FUEL",
      "description": "Petrol",
      "amount": "1000.00",
      "expense_date": "2026-10-24",
      "payment_mode": "CASH",
      "invoice_number": "",
      "due_date": null,
      "receipt": "",
      "is_recurring": false,
      "details": {},
      "status": "APPROVED",
      "created_by": [
        "darshil@buildsphere.com"
      ],
      "approved_by": [
        "darshil@buildsphere.com"
      ],
      "approved_at": "2026-10-24T03:13:22.324Z",
      "rejection_reason": "",
      "cancel_reason": "",
      "journal_entry": null,
      "id": 53
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:45:08.994Z",
      "updated_at": "2026-10-28T12:45:08.994Z",
      "deleted_at": null,
      "project": 33,
      "vendor": 15,
      "category": "MATERIAL",
      "description": "buy wires,plug,switches,putty, wooden sheets",
      "amount": "45000.00",
      "expense_date": "2026-10-28",
      "payment_mode": "CASH",
      "invoice_number": "",
      "due_date": null,
      "receipt": "receipts/GSRTC_Manthan.pdf",
      "is_recurring": false,
      "details": {},
      "status": "PENDING_APPROVAL",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "approved_by": null,
      "approved_at": null,
      "rejection_reason": "",
      "cancel_reason": "",
      "journal_entry": null,
      "id": 54
    }
  ],
  "vendors": [
    {
      "organization": 10,
      "created_at": "2026-10-28T12:44:53.558Z",
      "updated_at": "2026-10-28T12:44:53.558Z",
      "deleted_at": null,
      "name": "Mahaveer Hardwares",
      "contact_person": "Vishal Jain",
      "phone": "",
      "email": "",
      "address": "VASTRAL - RANIP ROAD, Ahmdabad",
      "tax_id": "233444323",
      "is_active": true,
      "id": 15
    }
  ],
  "advances": [
    {
      "organization": 10,
      "created_at": "2026-10-23T16:30:07.235Z",
      "updated_at": "2026-10-23T16:30:07.235Z",
      "deleted_at": null,
      "employee": 104,
      "project": 31,
      "amount": "2000.00",
      "advance_date": "2026-10-23",
      "reason": "[UPAD-12] Medical Emergency",
      "payment_mode": "CASH",
      "given_by": [
        "devesh@buildsphere.com"
      ],
      "adjusted_amount": "0.00",
      "status": "OPEN",
      "journal_entry": 81,
      "id": 13
    }
  ],
  "payroll_runs": [
    {
      "organization": 10,
      "created_at": "2026-10-22T19:16:00.858Z",
      "updated_at": "2026-10-22T19:16:00.881Z",
      "deleted_at": null,
      "project": 29,
      "period_start": "2026-10-01",
      "period_end": "2026-10-22",
      "status": "DRAFT",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "approved_by": null,
      "approved_at": null,
      "total_gross": "0.00",
      "total_advances": "0.00",
      "total_net": "0.00",
      "journal_entry": null,
      "notes": "",
      "id": 10
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:43:08.297Z",
      "updated_at": "2026-10-23T04:43:08.297Z",
      "deleted_at": null,
      "project": 29,
      "period_start": "2026-10-01",
      "period_end": "2026-10-23",
      "status": "APPROVED",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "approved_by": [
        "devesh@buildsphere.com"
      ],
      "approved_at": "2026-10-23T04:43:08.297Z",
      "total_gross": "0.00",
      "total_advances": "0.00",
      "total_net": "0.00",
      "journal_entry": null,
      "notes": "",
      "id": 11
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:33:28.749Z",
      "updated_at": "2026-10-23T16:33:28.799Z",
      "deleted_at": null,
      "project": 31,
      "period_start": "2026-10-22",
      "period_end": "2026-10-23",
      "status": "DRAFT",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "approved_by": null,
      "approved_at": null,
      "total_gross": "0.00",
      "total_advances": "0.00",
      "total_net": "0.00",
      "journal_entry": null,
      "notes": "",
      "id": 12
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:35:38.247Z",
      "updated_at": "2026-10-23T16:35:38.274Z",
      "deleted_at": null,
      "project": 30,
      "period_start": "2026-10-22",
      "period_end": "2026-10-23",
      "status": "DRAFT",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "approved_by": null,
      "approved_at": null,
      "total_gross": "0.00",
      "total_advances": "0.00",
      "total_net": "0.00",
      "journal_entry": null,
      "notes": "",
      "id": 13
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:13:57.078Z",
      "updated_at": "2026-10-24T03:13:57.116Z",
      "deleted_at": null,
      "project": 32,
      "period_start": "2026-10-24",
      "period_end": "2026-10-24",
      "status": "DRAFT",
      "created_by": [
        "darshil@buildsphere.com"
      ],
      "approved_by": null,
      "approved_at": null,
      "total_gross": "0.00",
      "total_advances": "0.00",
      "total_net": "0.00",
      "journal_entry": null,
      "notes": "",
      "id": 14
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T05:25:49.694Z",
      "updated_at": "2026-10-28T05:25:49.694Z",
      "deleted_at": null,
      "project": 29,
      "period_start": "2026-10-01",
      "period_end": "2026-10-28",
      "status": "APPROVED",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "approved_by": [
        "devesh@buildsphere.com"
      ],
      "approved_at": "2026-10-28T05:25:49.694Z",
      "total_gross": "0.00",
      "total_advances": "0.00",
      "total_net": "0.00",
      "journal_entry": null,
      "notes": "",
      "id": 15
    }
  ],
  "payroll_vouchers": [
    {
      "organization": 10,
      "created_at": "2026-10-23T04:43:08.304Z",
      "updated_at": "2026-10-23T04:43:08.304Z",
      "deleted_at": null,
      "run": 11,
      "employee": 100,
      "voucher_number": "VOU-00001",
      "days_present": 0,
      "half_days": 0,
      "paid_holidays": 0,
      "ot_hours": "0.00",
      "daily_rate_used": "800.00",
      "ot_rate_used": "0.00",
      "basic_pay": "800.00",
      "ot_pay": "0.00",
      "gross_pay": "800.00",
      "advances_deducted": "0.00",
      "net_pay": "800.00",
      "payment_mode": "CASH",
      "status": "PAID",
      "paid_at": "2026-10-23T04:43:08.304Z",
      "payment_reference": "Direct wage settlement",
      "id": 51
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T05:25:49.705Z",
      "updated_at": "2026-10-28T05:25:49.705Z",
      "deleted_at": null,
      "run": 15,
      "employee": 100,
      "voucher_number": "VOU-00002",
      "days_present": 0,
      "half_days": 0,
      "paid_holidays": 0,
      "ot_hours": "0.00",
      "daily_rate_used": "800.00",
      "ot_rate_used": "0.00",
      "basic_pay": "700.00",
      "ot_pay": "0.00",
      "gross_pay": "700.00",
      "advances_deducted": "0.00",
      "net_pay": "700.00",
      "payment_mode": "CASH",
      "status": "PAID",
      "paid_at": "2026-10-28T05:25:49.704Z",
      "payment_reference": "Direct wage settlement",
      "id": 52
    }
  ],
  "payments": [
    {
      "organization": 10,
      "created_at": "2026-10-22T19:13:17.746Z",
      "updated_at": "2026-10-22T19:13:17.746Z",
      "deleted_at": null,
      "employee": 100,
      "employee_id": 100,
      "employee_name": "Darshil",
      "employee_code": "EMP-0001",
      "project": 29,
      "project_id": 29,
      "project_name": "Farm House",
      "payment_type": "ADVANCE",
      "payment_mode": "UPI",
      "payment_date": "2026-10-22",
      "date": "2026-10-22",
      "advance_date": "2026-10-22",
      "type": "advance",
      "base_salary": "500.00",
      "expenses": "0.00",
      "amount": "500.00",
      "method": "upi",
      "status": "paid",
      "date_from": "2026-10-22",
      "date_to": "2026-10-22",
      "description": "Medicine",
      "approved_by": null,
      "approved_by_admin_name": "",
      "approved_at": null,
      "processed_by": [
        "devesh@buildsphere.com"
      ],
      "processed_at": "2026-10-22T19:13:17.746Z",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "transaction_id": "TXN-1792696397746-5313",
      "id": 11
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:30:07.219Z",
      "updated_at": "2026-10-23T16:30:07.219Z",
      "deleted_at": null,
      "employee": 104,
      "employee_id": 104,
      "employee_name": "Raviraj chauhan",
      "employee_code": "EMP-0005",
      "project": 31,
      "project_id": 31,
      "project_name": "Sky Avenue",
      "payment_type": "ADVANCE",
      "payment_mode": "CASH",
      "payment_date": "2026-10-23",
      "date": "2026-10-23",
      "advance_date": "2026-10-23",
      "type": "advance",
      "base_salary": "2000.00",
      "expenses": "0.00",
      "amount": "2000.00",
      "method": "cash",
      "status": "paid",
      "date_from": "2026-10-23",
      "date_to": "2026-10-23",
      "description": "Medical Emergency",
      "approved_by": null,
      "approved_by_admin_name": "",
      "approved_at": null,
      "processed_by": [
        "devesh@buildsphere.com"
      ],
      "processed_at": "2026-10-23T16:30:07.219Z",
      "created_by": [
        "devesh@buildsphere.com"
      ],
      "transaction_id": "TXN-1792773007219-2270",
      "id": 12
    }
  ],
  "accounts": [
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.907Z",
      "updated_at": "2026-10-22T18:05:30.907Z",
      "deleted_at": null,
      "code": "1001",
      "name": "Cash in Hand",
      "type": "ASSET",
      "is_active": true,
      "id": 118
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.910Z",
      "updated_at": "2026-10-22T18:05:30.910Z",
      "deleted_at": null,
      "code": "1002",
      "name": "Bank Account",
      "type": "ASSET",
      "is_active": true,
      "id": 119
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.912Z",
      "updated_at": "2026-10-22T18:05:30.912Z",
      "deleted_at": null,
      "code": "1100",
      "name": "Worker Advances",
      "type": "ASSET",
      "is_active": true,
      "id": 120
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.914Z",
      "updated_at": "2026-10-22T18:05:30.914Z",
      "deleted_at": null,
      "code": "1200",
      "name": "Client Receivable",
      "type": "ASSET",
      "is_active": true,
      "id": 121
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.916Z",
      "updated_at": "2026-10-22T18:05:30.916Z",
      "deleted_at": null,
      "code": "2001",
      "name": "Accounts Payable",
      "type": "LIABILITY",
      "is_active": true,
      "id": 122
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.918Z",
      "updated_at": "2026-10-22T18:05:30.918Z",
      "deleted_at": null,
      "code": "3001",
      "name": "Owner's Equity",
      "type": "EQUITY",
      "is_active": true,
      "id": 123
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.920Z",
      "updated_at": "2026-10-22T18:05:30.920Z",
      "deleted_at": null,
      "code": "4001",
      "name": "Project Revenue",
      "type": "REVENUE",
      "is_active": true,
      "id": 124
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.922Z",
      "updated_at": "2026-10-22T18:05:30.922Z",
      "deleted_at": null,
      "code": "5001",
      "name": "Material Expense",
      "type": "EXPENSE",
      "is_active": true,
      "id": 125
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.925Z",
      "updated_at": "2026-10-22T18:05:30.925Z",
      "deleted_at": null,
      "code": "5002",
      "name": "Equipment and Rental Expense",
      "type": "EXPENSE",
      "is_active": true,
      "id": 126
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.927Z",
      "updated_at": "2026-10-22T18:05:30.927Z",
      "deleted_at": null,
      "code": "5003",
      "name": "Fuel and Transport Expense",
      "type": "EXPENSE",
      "is_active": true,
      "id": 127
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.929Z",
      "updated_at": "2026-10-22T18:05:30.929Z",
      "deleted_at": null,
      "code": "5004",
      "name": "Utilities and Site Overhead",
      "type": "EXPENSE",
      "is_active": true,
      "id": 128
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.930Z",
      "updated_at": "2026-10-22T18:05:30.930Z",
      "deleted_at": null,
      "code": "5005",
      "name": "Wages Expense",
      "type": "EXPENSE",
      "is_active": true,
      "id": 129
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:30.933Z",
      "updated_at": "2026-10-22T18:05:30.933Z",
      "deleted_at": null,
      "code": "5006",
      "name": "Miscellaneous and Petty Cash",
      "type": "EXPENSE",
      "is_active": true,
      "id": 130
    }
  ],
  "journal_entries": [
    {
      "organization": 10,
      "created_at": "2026-10-24T03:13:22.339Z",
      "entry_number": "JE-000001",
      "date": "2026-10-24",
      "description": "Expense #53 [FUEL]: Petrol",
      "project": 32,
      "reference_type": "EXPENSE",
      "reference_id": 53,
      "posted_by": [
        "darshil@buildsphere.com"
      ],
      "reverses": null,
      "reversal_reason": "",
      "id": 80
    },
    {
      "organization": 10,
      "created_at": "2026-10-27T12:33:13.551Z",
      "entry_number": "JE-000002",
      "date": "2026-10-23",
      "description": "Advance #13 to EMP-0005",
      "project": 31,
      "reference_type": "ADVANCE",
      "reference_id": 13,
      "posted_by": [
        "devesh@buildsphere.com"
      ],
      "reverses": null,
      "reversal_reason": "",
      "id": 81
    }
  ],
  "journal_lines": [
    {
      "organization": 10,
      "created_at": "2026-10-24T03:13:22.341Z",
      "entry": 80,
      "account": 127,
      "side": "DR",
      "amount": "1000.00",
      "memo": "FUEL expense: Petrol",
      "id": 162
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:13:22.342Z",
      "entry": 80,
      "account": 118,
      "side": "CR",
      "amount": "1000.00",
      "memo": "Payment via CASH",
      "id": 163
    },
    {
      "organization": 10,
      "created_at": "2026-10-27T12:33:13.553Z",
      "entry": 81,
      "account": 120,
      "side": "DR",
      "amount": "2000.00",
      "memo": "Advance to EMP-0005 (Raviraj chauhan)",
      "id": 164
    },
    {
      "organization": 10,
      "created_at": "2026-10-27T12:33:13.554Z",
      "entry": 81,
      "account": 118,
      "side": "CR",
      "amount": "2000.00",
      "memo": "Advance disbursement via CASH",
      "id": 165
    }
  ],
  "transactions": [
    {
      "organization": 10,
      "created_at": "2026-10-22T18:19:20.540Z",
      "updated_at": "2026-10-22T18:19:20.540Z",
      "deleted_at": null,
      "transaction_id": "TXN-1792693160539-4287",
      "date": "2026-10-22",
      "type": "incoming",
      "category": "other",
      "payer_name": "Viren Prajapati",
      "payee_name": "Company Account",
      "amount": "150000.00",
      "method": "bank_transfer",
      "status": "completed",
      "description": "Through NEFT (CEMENT 100)",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {},
      "id": 9
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:20:15.956Z",
      "updated_at": "2026-10-22T18:22:32.266Z",
      "deleted_at": "2026-10-22T18:22:32.266Z",
      "transaction_id": "TXN-1792693215955-2757",
      "date": "2026-10-22",
      "type": "outgoing",
      "category": "vendor",
      "payer_name": "Company Account",
      "payee_name": "Darshil Gajera",
      "amount": "60000.00",
      "method": "bank_transfer",
      "status": "pending",
      "description": "Bolt purchase bill clear(10,000)",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {},
      "id": 10
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:22:13.983Z",
      "updated_at": "2026-10-22T18:22:13.983Z",
      "deleted_at": null,
      "transaction_id": "TXN-1792693333983-7491",
      "date": "2026-10-22",
      "type": "outgoing",
      "category": "other",
      "payer_name": "BuildSphere org.",
      "payee_name": "Darshil Gajera",
      "amount": "60000.00",
      "method": "bank_transfer",
      "status": "completed",
      "description": "Clear Payment",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {},
      "id": 11
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T19:13:17.753Z",
      "updated_at": "2026-10-28T12:47:21.492Z",
      "deleted_at": null,
      "transaction_id": "TXN-1792696397746-5313",
      "date": "2026-10-22",
      "type": "outgoing",
      "category": "salary",
      "payer_name": "BuildSphere org.",
      "payee_name": "Darshil",
      "amount": "500.00",
      "method": "upi",
      "status": "completed",
      "description": "[UPAD-11] ADVANCE: Medicine",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {
        "source": "upad",
        "paymentId": 11,
        "employeeId": 100,
        "paymentType": "advance"
      },
      "id": 14
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:30:07.230Z",
      "updated_at": "2026-10-28T12:47:21.491Z",
      "deleted_at": null,
      "transaction_id": "TXN-1792773007219-2270",
      "date": "2026-10-23",
      "type": "outgoing",
      "category": "salary",
      "payer_name": "BuildSphere org.",
      "payee_name": "Raviraj chauhan",
      "amount": "2000.00",
      "method": "cash",
      "status": "completed",
      "description": "[UPAD-12] ADVANCE: Medical Emergency",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {
        "source": "upad",
        "paymentId": 12,
        "employeeId": 104,
        "paymentType": "advance"
      },
      "id": 15
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T05:04:27.783Z",
      "updated_at": "2026-10-28T12:47:21.482Z",
      "deleted_at": null,
      "transaction_id": "TXN-EXP-53",
      "date": "2026-10-24",
      "type": "outgoing",
      "category": "other",
      "payer_name": "BuildSphere org.",
      "payee_name": "Vendor - Fuel",
      "amount": "1000.00",
      "method": "cash",
      "status": "completed",
      "description": "[EXP-53] Fuel: Petrol",
      "recorded_by": [
        "darshil@buildsphere.com"
      ],
      "metadata": {
        "source": "expense",
        "category": "FUEL",
        "expense_id": 53,
        "project_id": 32
      },
      "id": 16
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T05:04:27.785Z",
      "updated_at": "2026-10-28T12:47:21.483Z",
      "deleted_at": null,
      "transaction_id": "TXN-EXP-52",
      "date": "2026-10-23",
      "type": "outgoing",
      "category": "site_cost",
      "payer_name": "BuildSphere org.",
      "payee_name": "Vendor - Equipment Rental",
      "amount": "39000.00",
      "method": "cash",
      "status": "pending",
      "description": "[EXP-52] Equipment Rental: welding machine",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {
        "source": "expense",
        "category": "EQUIPMENT_RENTAL",
        "expense_id": 52,
        "project_id": 30
      },
      "id": 17
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T05:04:27.802Z",
      "updated_at": "2026-10-28T12:47:21.497Z",
      "deleted_at": null,
      "transaction_id": "TXN-VOU-51",
      "date": "2026-10-23",
      "type": "outgoing",
      "category": "salary",
      "payer_name": "BuildSphere org.",
      "payee_name": "Darshil",
      "amount": "800.00",
      "method": "cash",
      "status": "completed",
      "description": "[PAYROLL] VOU-00001 Wage Payout for Darshil",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {
        "run_id": 11,
        "source": "payroll",
        "voucher_id": 51,
        "employee_id": 100,
        "voucher_number": "VOU-00001"
      },
      "id": 18
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T05:26:06.180Z",
      "updated_at": "2026-10-28T12:47:21.498Z",
      "deleted_at": null,
      "transaction_id": "TXN-VOU-52",
      "date": "2026-10-28",
      "type": "outgoing",
      "category": "salary",
      "payer_name": "BuildSphere org.",
      "payee_name": "Darshil",
      "amount": "700.00",
      "method": "cash",
      "status": "completed",
      "description": "[PAYROLL] VOU-00002 Wage Payout for Darshil",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {
        "run_id": 15,
        "source": "payroll",
        "voucher_id": 52,
        "employee_id": 100,
        "voucher_number": "VOU-00002"
      },
      "id": 19
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:45:09.010Z",
      "updated_at": "2026-10-28T12:47:21.481Z",
      "deleted_at": null,
      "transaction_id": "TXN-EXP-54",
      "date": "2026-10-28",
      "type": "outgoing",
      "category": "vendor",
      "payer_name": "BuildSphere org.",
      "payee_name": "Mahaveer Hardwares",
      "amount": "45000.00",
      "method": "cash",
      "status": "pending",
      "description": "[EXP-54] Material: buy wires,plug,switches,putty, wooden sheets",
      "recorded_by": [
        "devesh@buildsphere.com"
      ],
      "metadata": {
        "source": "expense",
        "category": "MATERIAL",
        "expense_id": 54,
        "project_id": 33
      },
      "id": 20
    }
  ],
  "audit_logs": [
    {
      "organization": 10,
      "created_at": "2026-10-22T18:05:31.234Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 124
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:21:41.921Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 127
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T18:46:11.809Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 139
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T19:07:21.558Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 140
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T19:08:27.533Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "PROJECT_CREATED",
      "resource_type": "Project",
      "resource_id": "29",
      "changes": {
        "code": {
          "new": "PRJ-FARMH",
          "old": null
        },
        "name": {
          "new": "Farm House",
          "old": null
        },
        "estimated_budget": {
          "new": "0.00",
          "old": null
        }
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 141
    },
    {
      "organization": 10,
      "created_at": "2026-10-22T19:16:00.882Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "PAYROLL_CREATED",
      "resource_type": "PayrollRun",
      "resource_id": "10",
      "changes": {
        "period_end": "2026-10-22",
        "project_id": 29,
        "total_gross": "0.00",
        "period_start": "2026-10-01"
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 142
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:19:37.645Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 143
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:34:14.737Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "PROJECT_CREATED",
      "resource_type": "Project",
      "resource_id": "30",
      "changes": {
        "code": {
          "new": "SB-001",
          "old": null
        },
        "name": {
          "new": "Shivani Bunglow",
          "old": null
        },
        "estimated_budget": {
          "new": "20000000.00",
          "old": null
        }
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 144
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:42:32.507Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 145
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T04:50:28.944Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "EMPLOYEE_PAY_CHANGED",
      "resource_type": "Employee",
      "resource_id": "103",
      "changes": {
        "daily_rate": {
          "new": "300.00",
          "old": "800.00"
        },
        "monthly_salary": {
          "new": "0.00",
          "old": "0.00"
        },
        "ot_hourly_rate": {
          "new": "0.00",
          "old": "0.00"
        }
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 146
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T05:02:00.847Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 147
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T05:03:05.421Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "USER_CREATED",
      "resource_type": "User",
      "resource_id": "28",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 148
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T05:04:00.449Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "USER_CREATED",
      "resource_type": "User",
      "resource_id": "29",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 149
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T05:05:06.462Z",
      "actor": [
        "viren@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "29",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 150
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T05:06:39.694Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 151
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T05:31:14.488Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 152
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T07:45:20.985Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 153
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T07:55:28.560Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 154
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:12:05.955Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 155
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:13:20.789Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 156
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:20:04.319Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "PROJECT_CREATED",
      "resource_type": "Project",
      "resource_id": "31",
      "changes": {
        "code": {
          "new": "SA-003",
          "old": null
        },
        "name": {
          "new": "Sky Avenue",
          "old": null
        },
        "estimated_budget": {
          "new": "30000000.00",
          "old": null
        }
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 157
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:28:59.354Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 158
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:33:28.801Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "PAYROLL_CREATED",
      "resource_type": "PayrollRun",
      "resource_id": "12",
      "changes": {
        "period_end": "2026-10-23",
        "project_id": 31,
        "total_gross": "0.00",
        "period_start": "2026-10-22"
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 159
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:35:38.275Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "PAYROLL_CREATED",
      "resource_type": "PayrollRun",
      "resource_id": "13",
      "changes": {
        "period_end": "2026-10-23",
        "project_id": 30,
        "total_gross": "0.00",
        "period_start": "2026-10-22"
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 160
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:37:43.121Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "REPORT_EXPORTED",
      "resource_type": "",
      "resource_id": "",
      "changes": {},
      "metadata": {
        "format": "pdf",
        "row_count": 0,
        "project_id": 31,
        "report_type": "payroll_pdf"
      },
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 161
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:37:50.303Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "REPORT_EXPORTED",
      "resource_type": "",
      "resource_id": "",
      "changes": {},
      "metadata": {
        "format": "excel",
        "row_count": 0,
        "project_id": 31,
        "report_type": "dpr_excel"
      },
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 162
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:37:59.901Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "REPORT_EXPORTED",
      "resource_type": "",
      "resource_id": "",
      "changes": {},
      "metadata": {
        "format": "pdf",
        "row_count": 7,
        "project_id": null,
        "report_type": "profit_loss_pdf"
      },
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 163
    },
    {
      "organization": 10,
      "created_at": "2026-10-23T16:53:25.687Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 164
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T02:55:24.296Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 165
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:02:19.776Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 166
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:06:05.916Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "REPORT_EXPORTED",
      "resource_type": "",
      "resource_id": "",
      "changes": {},
      "metadata": {
        "format": "pdf",
        "row_count": 0,
        "project_id": 31,
        "report_type": "payroll_pdf"
      },
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 167
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:07:14.843Z",
      "actor": [
        "viren@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "29",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 168
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:08:30.185Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 169
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:08:55.430Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "USER_UPDATED",
      "resource_type": "User",
      "resource_id": "28",
      "changes": {
        "is_active": false
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 170
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:08:57.416Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "USER_UPDATED",
      "resource_type": "User",
      "resource_id": "28",
      "changes": {
        "is_active": true
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 171
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:09:55.730Z",
      "actor": [
        "darshil@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "28",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 172
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:11:25.465Z",
      "actor": [
        "darshil@buildsphere.com"
      ],
      "action": "PROJECT_CREATED",
      "resource_type": "Project",
      "resource_id": "32",
      "changes": {
        "code": {
          "new": "OL004",
          "old": null
        },
        "name": {
          "new": "One line Avenue",
          "old": null
        },
        "estimated_budget": {
          "new": "69999999.00",
          "old": null
        }
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 173
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:13:22.347Z",
      "actor": [
        "darshil@buildsphere.com"
      ],
      "action": "EXPENSE_APPROVED",
      "resource_type": "Expense",
      "resource_id": "53",
      "changes": {
        "amount": "1000.00",
        "status": "APPROVED",
        "auto_approved": true
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 174
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:13:57.117Z",
      "actor": [
        "darshil@buildsphere.com"
      ],
      "action": "PAYROLL_CREATED",
      "resource_type": "PayrollRun",
      "resource_id": "14",
      "changes": {
        "period_end": "2026-10-24",
        "project_id": 32,
        "total_gross": "0.00",
        "period_start": "2026-10-24"
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 175
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:14:15.046Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 176
    },
    {
      "organization": 10,
      "created_at": "2026-10-24T03:37:42.407Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      "id": 177
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T04:14:44.293Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 178
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T04:44:14.523Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 179
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T04:47:49.414Z",
      "actor": [
        "viren@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "29",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 180
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T04:49:24.843Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 181
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T04:50:13.480Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "USER_CREATED",
      "resource_type": "User",
      "resource_id": "30",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 182
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T05:24:47.963Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 183
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:36:32.994Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 184
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:38:54.729Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "PROJECT_CREATED",
      "resource_type": "Project",
      "resource_id": "33",
      "changes": {
        "code": {
          "new": "ASH-008",
          "old": null
        },
        "name": {
          "new": "Ashopalav House",
          "old": null
        },
        "estimated_budget": {
          "new": "45000000.00",
          "old": null
        }
      },
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 185
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:47:02.308Z",
      "actor": [
        "devesh@buildsphere.com"
      ],
      "action": "LOGOUT",
      "resource_type": "User",
      "resource_id": "27",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 186
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:47:06.417Z",
      "actor": [
        "darshil@buildsphere.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "28",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 187
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:47:15.931Z",
      "actor": [
        "darshil@buildsphere.com"
      ],
      "action": "LOGOUT",
      "resource_type": "User",
      "resource_id": "28",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 188
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:47:19.299Z",
      "actor": [
        "san@gmail.com"
      ],
      "action": "LOGIN_SUCCESS",
      "resource_type": "User",
      "resource_id": "30",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 189
    },
    {
      "organization": 10,
      "created_at": "2026-10-28T12:47:53.825Z",
      "actor": [
        "san@gmail.com"
      ],
      "action": "LOGOUT",
      "resource_type": "User",
      "resource_id": "30",
      "changes": {},
      "metadata": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "id": 190
    }
  ]
};
