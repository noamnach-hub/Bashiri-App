import { FIREBERRY_CONFIG } from './constants';

// --- Re-usable API Helpers ---
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'tokenid': FIREBERRY_CONFIG.TOKEN,
  'organizationid': FIREBERRY_CONFIG.ORG_ID
});

const fetchWithProxy = async (endpointUrl: string, options: RequestInit) => {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(endpointUrl)}`;
  return fetch(proxyUrl, options);
};

// --- Core Discovery Function ---

/**
 * Fetches the metadata for a single Fireberry object ID.
 * @param objectId The numeric ID of the object to inspect.
 * @returns A promise that resolves with the object's metadata or null if not found/error.
 */
const fetchObjectMetadata = async (objectId: string) => {
  try {
    const baseUrl = FIREBERRY_CONFIG.API_URL.replace(/\/api$/, '');
    const targetUrl = `${baseUrl}/metadata/records/${objectId}/fields`;

    const response = await fetchWithProxy(targetUrl, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      return null; // Object doesn't exist or is not accessible
    }

    const rawData = await response.json();
    const fields = rawData.Data || rawData.data || (Array.isArray(rawData) ? rawData : []);
    
    // Attempt to find a "name" or "displayname" field to identify the object
    const nameField = fields.find((f: any) => f.logicalname?.toLowerCase() === 'name');
    const objectDisplayName = fields.length > 0 ? fields[0].entitydisplayname : `Unknown Object ${objectId}`;

    return {
      id: objectId,
      name: objectDisplayName,
      fieldCount: fields.length,
      fields: fields.map((f: any) => ({
        displayName: f.displayname,
        logicalName: f.logicalname,
        type: f.type
      }))
    };
  } catch {
    return null;
  }
};


// --- Main Runner ---

/**
 * Runs a comprehensive scan of the Fireberry system to map out all discoverable objects and fields.
 * Logs the results to the developer console.
 */
export const mapSystemSchema = async () => {
  console.log('%c--- STARTING FIREBERRY SCHEMA DISCOVERY ---', 'color: #A2D294; font-size: 16px; font-weight: bold;');
  console.log('This may take a moment. The script will test a wide range of Object IDs to map the system.');

  const objectIdsToTest: string[] = [];
  const foundObjects = [];

  // Define ranges to scan
  const rangesToScan = [
    { start: 1, end: 50, description: "Standard Objects" },      // Standard CRM objects
    { start: 1000, end: 1050, description: "Custom Objects" }, // Common range for custom objects
    { start: 4200, end: 4220, description: "Activity Objects"} // Activity types like Task, Email etc.
  ];

  // Populate the test array from ranges
  for (const range of rangesToScan) {
    for (let i = range.start; i <= range.end; i++) {
        objectIdsToTest.push(i.toString());
    }
  }
  
  // Start scanning
  let discoveredCount = 0;
  for (let i = 0; i < objectIdsToTest.length; i++) {
    const id = objectIdsToTest[i];
    console.log(`Scanning... [${i+1}/${objectIdsToTest.length}] ID: ${id}`);
    const metadata = await fetchObjectMetadata(id);
    if (metadata && metadata.fieldCount > 0) {
      foundObjects.push(metadata);
      discoveredCount++;
      console.log(`%c✓ Discovered Object ID: ${id} -> ${metadata.name} (${metadata.fieldCount} fields)`, 'color: green;');
    }
  }

  console.log('%c--- SCHEMA DISCOVERY COMPLETE ---', 'color: #A2D294; font-size: 16px; font-weight: bold;');

  if (foundObjects.length === 0) {
    console.warn('Could not discover any objects. Check API credentials, proxy, and permissions.');
    return;
  }
  
  console.log(`Discovered a total of ${discoveredCount} objects.`);
  
  console.log("--- SUMMARY OF DISCOVERED OBJECTS ---");
  console.table(foundObjects.map(obj => ({
    ID: obj.id,
    Name: obj.name,
    'Field Count': obj.fieldCount,
  })));
  
  console.log("--- DETAILED FIELD MAP (click to expand) ---");
  foundObjects.forEach(obj => {
      console.groupCollapsed(`Fields for ${obj.name} (ID: ${obj.id})`);
      console.table(obj.fields.sort((a,b) => a.displayName.localeCompare(b.displayName)));
      console.groupEnd();
  });
};
