import axios from 'axios';

export interface NearbyResult {
  schoolsCount: number;
  parksCount: number;
  metroStations: Array<{ lat: number; lng: number; distance: number }>;
}

export async function fetchNearbyYandex(lat: number, lng: number, radius: number): Promise<NearbyResult | null> {
  const apiKey = process.env.YANDEX_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const base = 'https://search-maps.yandex.ru/v1/';

    const [schools, parks, metro] = await Promise.all([
      axios.get(base, { params: { text: 'школа', ll: `${lng},${lat}`, spn: `${radius/1000},${radius/1000}`, type: 'biz', results: 200, apikey: apiKey }}),
      axios.get(base, { params: { text: 'парк', ll: `${lng},${lat}`, spn: `${radius/1000},${radius/1000}`, type: 'biz', results: 200, apikey: apiKey }}),
      axios.get(base, { params: { text: 'метро', ll: `${lng},${lat}`, spn: `${radius/1000},${radius/1000}`, type: 'biz', results: 50, apikey: apiKey }}),
    ]);

    const metroStations = (metro.data?.features || []).map((f: any) => {
      const mlat = f.geometry.coordinates[1];
      const mlng = f.geometry.coordinates[0];
      const dist = haversine(lat, lng, mlat, mlng);
      return { lat: mlat, lng: mlng, distance: dist };
    });

    return {
      schoolsCount: (schools.data?.features || []).length,
      parksCount: (parks.data?.features || []).length,
      metroStations,
    };
  } catch {
    return null;
  }
}

export async function fetchNearbyDGIS(lat: number, lng: number, radius: number): Promise<NearbyResult | null> {
  const apiKey = process.env.DGIS_API_KEY;
  if (!apiKey) return null;

  try {
    const base = 'https://catalog.api.2gis.com/3.0/items';

    async function searchRubric(rubricId: string, pageSize = 50) {
      const resp = await axios.get(base, {
        params: {
          key: apiKey,
          lat, lon: lng,
          radius,
          rubric_id: rubricId,
          page_size: pageSize,
        }
      });
      return resp.data?.result?.items || [];
    }

    const [schools, parks, metro] = await Promise.all([
      searchRubric('156'), // школы
      searchRubric('161'), // парки
      searchRubric('189'), // метро/станции (прибл.)
    ]);

    const metroStations = metro.map((m: any) => {
      const p = m.point || { lat: lat, lon: lng };
      const dist = haversine(lat, lng, p.lat, p.lon);
      return { lat: p.lat, lng: p.lon, distance: dist };
    });

    return {
      schoolsCount: schools.length,
      parksCount: parks.length,
      metroStations,
    };
  } catch {
    return null;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
function toRad(deg: number) { return deg * Math.PI / 180; }