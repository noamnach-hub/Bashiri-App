import { FIREBERRY_CONFIG, LEAD_STATUS_NEW, TASK_STATUS_COMPLETED } from '../constants';
import { FireberryTask, FireberryUser, FireberryInquiry } from '../types';
import { addDebugLog } from './debugService';

const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'tokenid': FIREBERRY_CONFIG.TOKEN,
    'organizationid': FIREBERRY_CONFIG.ORG_ID
  };
};

const fetchWithProxy = async (endpointUrl: string, options: RequestInit) => {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(endpointUrl)}`;
  return fetch(proxyUrl, options);
};

// Minimal cache just to prevent crash on total network failure, but empty mainly
const CACHED_USERS: FireberryUser[] = [];

const mapSystemUsersToUsers = (data: any): FireberryUser[] => {
  const results = Array.isArray(data) ? data :
    (data.data?.Records || data.data?.Data || data.Records || []);

  return results.map((u: any) => ({
    id: u.systemuserid || u.crmuserid || u.ownerid,
    agentId: u.systemuserid || u.crmuserid || u.ownerid,
    username: u.fullname || `${u.firstname} ${u.lastname}`, // Display Name
    emailaddress: (u.username || u.emailaddress1 || '').trim(), // Login Email (User requested 'username' field)
    password: (u.telephone2 || u.mobilephone || '').trim(), // Password (telephone2)
    isactive: u.status === 'פעיל' // Check Hebrew status field
  })).filter((u: FireberryUser) => u.isactive); // Only return active users
};

const mapAgents = (data: any): any[] => {
  const results = Array.isArray(data) ? data :
    (data.data?.Records || data.data?.Data || data.Records || []);

  return results.map((a: any) => ({
    id: a.customobject1012id,
    name: a.name,
    status: a.statuscodename || a.statuscode,
    phone: a.pcfsystemfield438 || a.telephone1 || '',
    email: a.pcfsystemfield446 || a.emailaddress || '',
    validUntil: a.pcfsystemfield439,
    createdOn: a.createdon,
    modifiedOn: a.modifiedon,
    ownerId: a.ownerid,
    ownerName: a.owneridname || '',
    serialNumber: a.pcfsystemfield901 || '', // מספר סידורי
    linkedLeadId: a.pcfsystemfield440 || '' // ליד מקושר
  }));
};

const mapLeads = (data: any): any[] => {
  const results = Array.isArray(data) ? data :
    (data.data?.Records || data.data?.Data || data.Records || []);

  return results.map((l: any) => ({
    id: l.customobject1014id,
    name: l.name, // שם ☎
    phone: l.pcfsystemfield751 || l.telephone1 || '', // טלפון
    email: l.pcfsystemfield753 || '', // מייל
    status: l.pcfsystemfield875 || l.statuscodename || '', // סטטוס סוכן
    description: l.pcfsystemfield754 || '', // תיאור פניה
    createdOn: l.createdon,
    ownerId: l.ownerid,
    linkedCustomerName: l.pcfsystemfield740name || l.pcfsystemfield740 || '', // שם לקוח מקושר
    customerType: l.pcfsystemfield145name || l.pcfsystemfield145 || '', // סוג לקוח 1
    answeredBy: l.pcfsystemfield743name || l.pcfsystemfield743 || '', // מי ענה לשיחה
    handledBy: l.pcfSochenMetapelPniya550name || l.pcfSochenMetapelPniya550 || '', // מי טיפל בליד 550
    updateTime: l.pcfRishom550aiTariShsha || '', // 550 עדכון
    leadSource: l.pcfsystemfield752name || l.pcfsystemfield752 || '', // מקור הגעה
    receivedBy: l.owneridname || '', // מי קיבל את הליד
    answerStatus: l.pcfsystemfield734 || '', // ענה/לא ענה
    callDuration: l.pcfsystemfield750 || l.pcfsystemfield746 || '', // זמן שיחה
    handlerType: l.pcfsystemfield900name || l.pcfsystemfield900 || '' // סוג מטפל
  }));
};

export const testApiConnection = async (): Promise<{ success: boolean, message: string }> => {
  try {
    const url = `${FIREBERRY_CONFIG.API_URL}/record/account?page_size=1`;
    const response = await fetchWithProxy(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (response.ok) {
      return { success: true, message: 'חיבור תקין ל-Fireberry' };
    } else {
      return { success: false, message: `שגיאת API: ${response.status}` };
    }
  } catch (e) {
    return { success: false, message: `מצב לא מקוון` };
  }
};

export const getAllUsers = async (): Promise<FireberryUser[]> => {
  addDebugLog("getAllUsers START", "Function called");
  try {
    // Use the /record/CrmUser endpoint as shown in the API documentation
    const recordUrl = `${FIREBERRY_CONFIG.API_URL}/record/CrmUser`;
    addDebugLog("getAllUsers URL", recordUrl);
    let response = await fetchWithProxy(recordUrl, {
      method: 'GET',
      headers: getHeaders()
    });

    addDebugLog("getAllUsers Response", { ok: response.ok, status: response.status });
    if (!response.ok) {
      addDebugLog("getAllUsers FAIL", `Response not OK: ${response.status}`);
      return [];
    }

    const data = await response.json();
    addDebugLog("getAllUsers RAW", { keys: Object.keys(data), dataKeys: data.data ? Object.keys(data.data) : 'no data obj' });
    const mapped = mapSystemUsersToUsers(data);

    addDebugLog("getAllUsers", {
      count: mapped.length,
      sample: mapped.length > 0 ? {
        display: mapped[0].username,
        email: mapped[0].emailaddress,
        pass: mapped[0].password,
        active: mapped[0].isactive
      } : "No users found"
    });

    return mapped.length > 0 ? mapped : [];
  } catch (error) {
    console.error("Error fetching all users:", error);
    addDebugLog("getAllUsers Error", error);
    return [];
  }
};

export const getAgents = async (ownerId: string): Promise<any[]> => {
  try {
    const queryUrl = `${FIREBERRY_CONFIG.API_URL}/query`;
    let response = await fetchWithProxy(queryUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        objecttype: "1012", // Agents table
        query: `(ownerid = '${ownerId}')`,
        sort_type: "desc",
        page_size: 50
      })
    });

    if (!response.ok) return [];

    const data = await response.json();
    return mapAgents(data);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return [];
  }
};

export const getLeadsByAgentId = async (agentId: string): Promise<any[]> => {
  try {
    const queryUrl = `${FIREBERRY_CONFIG.API_URL}/query`;
    let allLeads: any[] = [];
    let pageNumber = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      let response = await fetchWithProxy(queryUrl, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          objecttype: "1014", // פניות table
          // Re-applied Status filter using integer value 2 (matches '2. חדש')
          query: `(pcfsystemfield758 = '${agentId}') AND (pcfsystemfield875 = 2)`,
          sort_type: "desc",
          page_size: 100,
          page_number: pageNumber
        })
      });

      if (!response.ok) break;

      const data = await response.json();
      const leads = mapLeads(data);

      // DEBUG: Log the statuses we found to verify the correct value for "2. חדש"
      // DEBUG: Log the statuses we found to verify the correct value for "2. חדש"
      if (leads.length > 0 && pageNumber === 1) {
        // Log mapped status
        addDebugLog("MAPPED STATUS VALUES", leads.slice(0, 5).map(l => ({ name: l.name, status: l.status })));

        // Let's verify what `pcfsystemfield875` raw value is - handling Data vs Records
        const rawRecords = Array.isArray(data) ? data : (data.data?.Records || data.data?.Data || []);
        addDebugLog("RAW STATUS VALUES", rawRecords.map((r: any) => ({
          id: r.customobject1014id,
          '758(Agent)': r.pcfsystemfield758,
          '875(Status)': r.pcfsystemfield875,
          '875name': r.pcfsystemfield875name
        })).slice(0, 5));
      }

      allLeads = [...allLeads, ...leads];

      // Check if there are more pages
      if (leads.length < 100) {
        hasMorePages = false;
      } else {
        pageNumber++;
      }
    }

    return allLeads;
  } catch (error) {
    console.error("Error fetching leads for agent:", error);
    return [];
  }
};

/**
 * Robustly fetches total results for a query.
 * Handles the standard TotalResults field in Fireberry/Powerlink responses.
 */

export const getRecordCount = async (objectType: string, userIdField: string, id: string): Promise<number> => {
  try {
    const url = `${FIREBERRY_CONFIG.API_URL}/query`;
    const payload = {
      objecttype: objectType,
      query: `(${userIdField} = '${id}')`,
      page_number: "1",
      page_size: "5", // Drastically reduced to strict 1MB proxy limit
      return_count: true,
      sort_by: "modifiedon",
      sort_type: "desc"
    };

    addDebugLog(`Count Request ${objectType}`, { payload, id, userIdField });

    let response = await fetchWithProxy(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      addDebugLog(`Parse Error ${objectType}`, rawText);
      return 0;
    }

    addDebugLog(`Count ${objectType}`, {
      payload,
      keys: Object.keys(data),
      dataKeys: data.data ? Object.keys(data.data) : 'No Data Object',
      sample: JSON.stringify(data).substring(0, 200) + '...'
    });

    if (!response.ok) {
      console.warn(`API returned ${response.status} for ${objectType}`);
      return 0;
    }

    // Fireberry typically returns TotalResults at the root or within a 'data' wrapper
    // User JSON shows "Total_Records": 15970 inside "data" object
    const total = data.Total_Records ?? data.data?.Total_Records ??
      data.TotalResults ?? data.totalResults ?? data.data?.TotalResults ??
      (data.success === true && data.data?.Total_Records) ?? 0;

    // If explicit count is 0, we check array length.
    // Now with page_size 20, we can see if we get ANY records.
    if (total === 0) {
      const records = Array.isArray(data) ? data :
        (data.data?.Records || data.data?.Data || data.Records || []);

      // If we got 20 records, we might have more. But for now, returning 20 is better than 0.
      return records.length;
    }

    return total;
  } catch (error) {
    console.error("Error fetching record count:", error);
    addDebugLog(`Error ${objectType}`, error);
    return 0;
  }
};

export const getMyInquiries = async (agentId: string): Promise<FireberryInquiry[]> => {
  try {
    const url = `${FIREBERRY_CONFIG.API_URL}/query`;
    let response = await fetchWithProxy(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        objecttype: "1014",
        query: `(pcfsystemfield758 = '${agentId}')`, // Using pcfsystemfield758 as requested
        sort_by: "modifiedon",
        sort_type: "desc",
        page_number: "1",
        page_size: "50"
      })
    });

    if (!response.ok) {
      console.warn("API failure for inquiries");
      return [];
    }

    const data = await response.json();
    const results = Array.isArray(data) ? data :
      (data.data?.Records || data.data?.Data || data.Records || []);

    return results.map((item: any) => ({
      id: item.customobject1014id,
      name: item.name,
      phone: item.telephone1 || item.phone || '',
      email: item.pcfsystemfield753, // Assuming these fields are correct, might need verification
      description: item.pcfsystemfield754,
      statuscode: item.pcfsystemfield751,
      // createdon: item.createdon, // Might need to be added if sort uses it
      agentId: item.pcfsystemfield758
    }));
  } catch (err) {
    console.warn("Error fetching inquiries:", err);
    return [];
  }
};

export const updateInquiryStatus = async (id: string, newStatus: string): Promise<boolean> => {
  try {
    const url = `${FIREBERRY_CONFIG.API_URL}/record/customobject1014/${id}`;
    const response = await fetchWithProxy(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ pcfsystemfield751: newStatus })
    });
    return response.ok;
  } catch {
    return true;
  }
};

export const getMyTasks = async (userId: string): Promise<FireberryTask[]> => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const url = `${FIREBERRY_CONFIG.API_URL}/record/task/query`;
    const response = await fetchWithProxy(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        where: [
          { field: 'ownerid', value: userId, operator: 'eq' },
          { field: 'statuscode', value: TASK_STATUS_COMPLETED, operator: 'ne' },
          { field: 'scheduledend', value: today.toISOString(), operator: 'le' }
        ],
        limit: 50,
        sort_by: "scheduledend",
        sort_type: "asc"
      })
    });

    if (!response.ok) return [];

    const data = await response.json();
    const results = Array.isArray(data.Data) ? data.Data : (Array.isArray(data.data) ? data.data : []);

    return results.map((t: any) => ({
      activityid: t.activityid,
      subject: t.subject,
      description: t.description,
      scheduledend: t.scheduledend,
      statuscode: t.statuscode,
      regardingobjectid: t.regardingobjectid,
      regardingobjectidname: t.regardingobjectidname,
      ownerid: t.ownerid
    }));
  } catch {
    return [];
  }
};