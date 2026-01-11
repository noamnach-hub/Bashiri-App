---
description: How to work with Fireberry API fields in this project
---

# Fireberry Field Mapping Workflow

## CRITICAL: Always Check Schema First!

Before using ANY Fireberry field in the code, you MUST:

1. **Check the schema file** at `fireberry-schema.json` in the project root
2. Search for the Hebrew label (e.g., "מספר סידורי") to find the correct `fieldName`
3. Use the exact `fieldName` from the schema (e.g., `pcfsystemfield901`)

## Schema File Location
- **Path**: `c:\Users\noam_\OneDrive\Desktop\NachlieliAI\barishi\Bashiri APP\fireberry-schema.json`

## Schema Structure
Each field entry contains:
```json
{
  "label": "Hebrew field name",
  "fieldName": "pcfsystemfieldXXX or standard name",
  "systemFieldTypeId": "...",
  "systemName": "objectName"
}
```

## Common Objects
- `customobject1012` = סוכנים (Agents)
- `CrmUser` = משתמשים (System Users)
- `customobject1014` = פניות (Inquiries)

## DO NOT GUESS FIELD NAMES!
Always verify against the schema before implementing any field mapping.
