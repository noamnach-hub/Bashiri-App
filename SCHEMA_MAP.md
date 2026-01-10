# Fireberry CRM Schema Map

This document serves as the central source of truth for the Fireberry CRM data structure used in the Bashiri Agent Portal. All development should refer to this map to ensure correct `ObjectID` and `logicalname` values are used in API calls.

This map is based on initial analysis and will be updated by the `schemaMapper.ts` discovery script.

---

## 1. Standard Objects (Known & Discovered)

### **Object: User (Agent)**
- **ObjectID**: `8`
- **Description**: Represents the agents/employees using the system. This is the primary object for authentication.
- **Key Fields**:
| Display Name (Hebrew) | Logical Name (`field`)        | Type      | Notes                                    |
|-----------------------|-------------------------------|-----------|------------------------------------------|
| שם מלא                 | `fullname` or `name`          | `string`  | The agent's full name.                   |
| דואר אלקטרוני          | `internalemailaddress`        | `string`  | Login email. **Primary Key for Login**.  |
| מזהה משתמש             | `systemuserid`                | `guid`    | The unique ID for the user.              |
| לא פעיל                | `isdisabled`                  | `boolean` | `true` if the user is inactive.          |
| **סיסמה (מותאם)**      | `pcfsystemfield438`           | `string`  | **Critical:** Custom field for password. **This field should contain the user's phone number.** |

---

### **Object: Task (Follow-up)**
- **ObjectID**: `4212` (Hypothesized standard ID)
- **Description**: Represents tasks, specifically follow-up calls for agents.
- **Key Fields**:
| Display Name (Hebrew) | Logical Name (`field`)        | Type      | Notes                                    |
|-----------------------|-------------------------------|-----------|------------------------------------------|
| נושא                  | `subject`                     | `string`  | The main description of the task.        |
| תאריך יעד              | `scheduledend`                | `datetime`| Due date for the follow-up.              |
| סטטוס                 | `statuscode`                  | `picklist`| e.g., 'Open', 'Completed' ('הושלם').   |
| מזהה בעלים             | `ownerid`                     | `lookup`  | Links to the User object (`systemuserid`)|
| לגבי                   | `regardingobjectid`           | `lookup`  | Links to the related Lead/Account.       |
| שם 'לגבי'              | `regardingobjectidname`       | `string`  | The name of the linked Lead/Account.     |
| מזהה פעילות            | `activityid`                  | `guid`    | The unique ID for the task.              |

---

## 2. Custom Objects

### **Object: Inquiry (פנייה)**
- **ObjectID**: `1014`
- **Description**: A custom object representing a new, raw lead or inquiry that needs initial handling.
- **Key Fields**:
| Display Name (Hebrew) | Logical Name (`field`)        | Type      | Notes                                    |
|-----------------------|-------------------------------|-----------|------------------------------------------|
| שם הפנייה              | `name`                        | `string`  | Name of the person making the inquiry.   |
| טלפון                 | `telephone1`                  | `string`  | Contact phone number.                    |
| תיאור                 | `description`                 | `string`  | Details about the inquiry.               |
| סטטוס                 | `statuscode`                  | `picklist`| e.g., 'לא טופל', 'טופל'.                |
| תאריך יצירה            | `createdon`                   | `datetime`| When the inquiry was created.            |
| **סוכן מטפל (מותאם)**  | `pcfsystemfield758`           | `lookup`  | **Critical:** Links to the User (`ownerid`)|
| מזהה פנייה             | `customobject1014id`          | `guid`    | The unique ID for the inquiry record.    |

---

### **Object: Tour (סיור)**
- **ObjectID**: (To be discovered by `schemaMapper.ts`)
- **Description**: A custom object to log property tours conducted by agents.
- **Key Fields**:
| Display Name (Hebrew) | Logical Name (`field`)        | Type      | Notes                                    |
|-----------------------|-------------------------------|-----------|------------------------------------------|
| שם הסיור               | `name` (likely)               | `string`  | e.g., "Tour for Israel Israeli at...".   |
| מזהה בעלים             | `ownerid` (likely)            | `lookup`  | Links to the User object (`systemuserid`)|
| תאריך הסיור            | `scheduledstart` (likely)     | `datetime`| Date and time of the tour.               |
| לקוח משויך             | `regardingobjectid` (likely)  | `lookup`  | Links to the Account/Contact.            |
