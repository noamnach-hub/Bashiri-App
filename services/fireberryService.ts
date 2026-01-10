import { FIREBERRY_CONFIG, LEAD_STATUS_NEW, TASK_STATUS_COMPLETED } from '../constants';
import { FireberryTask, FireberryUser, FireberryInquiry } from '../types';

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

const mapAgentsToUsers = (data: any): FireberryUser[] => {
  const results = Array.isArray(data) ? data : (data.Data || data.data || []);
  return results.map((a: any) => ({
    id: a.ownerid, // The System User ID
    agentId: a.customobject1012id, // The Agent Record ID
    username: a.name,
    emailaddress: (a.pcfsystemfield446 || '').trim(),
    password: (a.pcfsystemfield438 || '').trim(),
    isactive: true
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
  try {
    const queryUrl = `${FIREBERRY_CONFIG.API_URL}/record/customobject1012/query`;
    let response = await fetchWithProxy(queryUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ page_size: 100 })
    });

    if (response.status === 404) {
      const fallbackUrl = `${FIREBERRY_CONFIG.API_URL}/record/1012/query`;
      response = await fetchWithProxy(fallbackUrl, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ page_size: 100 })
      });
    }

    if (!response.ok) return [];

    const data = await response.json();
    const mapped = mapAgentsToUsers(data);
    return mapped.length > 0 ? mapped : [];
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
};

/**
 * Robustly fetches total results for a query.
 * Handles the standard TotalResults field in Fireberry/Powerlink responses.
 */
export const getRecordCount = async (objectType: string, userIdField: string, id: string): Promise<number> => {
  try {
    const url = `${FIREBERRY_CONFIG.API_URL}/record/${objectType}/query`;
    let response = await fetchWithProxy(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        where: [{ field: userIdField, value: id, operator: 'eq' }],
        page_size: 1,
        return_count: true // Request total results metadata
      })
    });

    if (response.status === 404) {
      // Try with numeric object type
      const numericId = objectType.startsWith('customobject') ? objectType.replace('customobject', '') : objectType;
      const fallbackUrl = `${FIREBERRY_CONFIG.API_URL}/record/${numericId}/query`;
      response = await fetchWithProxy(fallbackUrl, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          where: [{ field: userIdField, value: id, operator: 'eq' }],
          page_size: 1,
          return_count: true
        })
      });
    }

    if (!response.ok) {
      console.warn(`API returned ${response.status} for ${objectType}`);
      return 0;
    }

    const data = await response.json();

    // Fireberry typically returns TotalResults at the root or within a 'data' wrapper
    const total = data.TotalResults ?? data.totalResults ?? data.data?.TotalResults ?? 0;

    // If we get data but no TotalResults metadata, fall back to array length
    if (total === 0 && (Array.isArray(data.Data) || Array.isArray(data.data))) {
      return (data.Data || data.data).length;
    }

    return total;
  } catch (error) {
    console.error("Error fetching record count:", error);
    return 0;
  }
};

export const getMyInquiries = async (agentId: string): Promise<FireberryInquiry[]> => {
  try {
    const url = `${FIREBERRY_CONFIG.API_URL}/record/customobject1014/query`;
    let response = await fetchWithProxy(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        where: [
          { field: 'pcfsystemfield758', value: agentId, operator: 'eq' }
        ],
        limit: 500,
        sort_by: "createdon",
        sort_type: "desc"
      })
    });

    // Fallback to numeric ID if customobjectName fails
    if (response.status === 404) {
      const fallbackUrl = `${FIREBERRY_CONFIG.API_URL}/record/1014/query`;
      response = await fetchWithProxy(fallbackUrl, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          where: [{ field: 'pcfsystemfield758', value: agentId, operator: 'eq' }],
          limit: 500
        })
      });
    }

    if (!response.ok) {
      console.warn("API failure for inquiries");
      return [];
    }

    const data = await response.json();
    const results = Array.isArray(data.Data) ? data.Data : (Array.isArray(data.data) ? data.data : []);

    return results.map((item: any) => ({
      id: item.customobject1014id,
      name: item.name,
      phone: item.telephone1 || item.phone || '',
      email: item.pcfsystemfield753,
      description: item.pcfsystemfield754,
      statuscode: item.pcfsystemfield751,
      createdon: item.createdon,
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