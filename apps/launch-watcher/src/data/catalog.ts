import { classifyOrbit, parseTle, tleToElements, type OrbitClass, type OrbitalElements, type Tle } from '@aperture/orbital-core'

/** Raw catalog entry as supplied (TLE lines + metadata) */
interface RawEntry {
  name: string
  norad_id: number
  tle1: string
  tle2: string
  operator: string
  launch_date: string
  mission: string
  status: string
}

export interface CatalogSatellite {
  id: string
  name: string
  noradId: number
  operator: string
  launchDate: string
  mission: string
  status: string
  tle: Tle
  lines: [string, string]
  elements: OrbitalElements
  orbitClass: OrbitClass
  color: string
}

/**
 * Canadian-operated (and one Canada-relevant) satellites.
 * Note: the four GEO line-2 entries were supplied with mean motion and revolution
 * number run together (68 characters). They are repaired here by inserting the
 * missing column separator; their checksums then validate.
 */
const RAW: RawEntry[] = [
  { name: 'SAPPHIRE', norad_id: 39088, tle1: '1 39088U 13009C   25297.72717685  .00000254  00000-0  10395-3 0  9991', tle2: '2 39088  98.4172 117.8868 0010342 226.4031 133.6297 14.35131764662806', operator: 'DND/CAF', launch_date: 'Feb 25, 2013', mission: 'Space surveillance in MEO/GEO', status: 'Active' },
  { name: 'RADARSAT-2', norad_id: 32382, tle1: '1 32382U 07061A   25297.86575773  .00000116  00000+0  61896-4 0  9996', tle2: '2 32382  98.5813 303.1603 0001129  89.7632 270.3680 14.29982529932324', operator: 'MDA Space', launch_date: 'Dec 14, 2007', mission: 'C-band Synthetic Aperture Radar (SAR) Earth Observation', status: 'Active' },
  { name: 'COSMOS 2518', norad_id: 42719, tle1: '1 42719U 17027A   25287.72825124  .00000666  00000-0  00000-0 0  9993', tle2: '2 42719  63.0708 279.0648 7105048 273.0899  14.9804  2.00754526 61473', operator: 'Russian VKS (VVKO)', launch_date: 'May 25, 2017', mission: 'Early-warning missile detection (EKS/Tundra system)', status: 'Active' },
  { name: 'CANX-4', norad_id: 40055, tle1: '1 40055U 14034C   25299.17959660  .00001666  00000+0  22427-3 0  9994', tle2: '2 40055  98.3415 160.5151 0013972  46.6478 313.5895 14.80589938609893', operator: 'UTIAS/SFL', launch_date: '30 June 2014', mission: 'Dual-nanosatellite formation flying demonstration', status: 'Active' },
  { name: 'CANX-5', norad_id: 40056, tle1: '1 40056U 14034D   25299.18064083  .00001673  00000+0  22515-3 0  9998', tle2: '2 40056  98.3418 160.5460 0013967  46.8469 313.3907 14.80605545600702', operator: 'UTIAS/SFL', launch_date: '30 June 2014', mission: 'Dual-nanosatellite formation flying demonstration', status: 'Active' },
  { name: 'ANIK F1R', norad_id: 28868, tle1: '1 28868U 05036A   25299.30514060 -.00000062  00000+0  00000+0 0  9999', tle2: '2 28868   3.7099  79.4665 0001890 101.2857 216.7569  1.00272547 44104', operator: 'Telesat Canada Ltd.', launch_date: '9 September 2005', mission: 'Geostationary communications (C-band and Ku-band) for North America', status: 'Active' },
  { name: 'TELSTAR 11N', norad_id: 34111, tle1: '1 34111U 09009A   25299.25264900 -.00000238  00000+0  00000+0 0  9995', tle2: '2 34111   0.0185 251.1810 0002157 304.6051 252.5245  1.00270638 43894', operator: 'Telesat Canada Ltd.', launch_date: '26 February 2009', mission: 'Geostationary communications (Ku-band) over North America, Atlantic, Europe, and Africa', status: 'Active' },
  { name: 'GHGSAT-C1', norad_id: 46278, tle1: '1 46278U 20061G   25299.29148322  .00024038  00000+0  34733-3 0  9993', tle2: '2 46278  97.2368  14.2182 0002347 154.8133 205.3237 15.55938927286937', operator: 'GHGSat Inc.', launch_date: '2 September 2020', mission: 'High-resolution monitoring of methane emissions from industrial sites', status: 'Active' },
  { name: 'GHGSAT-C2', norad_id: 47509, tle1: '1 47509U 21006DA  25299.10188428  .00008178  00000+0  24940-3 0  9998', tle2: '2 47509  97.2512 345.4134 0003932 297.2959  62.7883 15.34191152263914', operator: 'GHGSat Inc.', launch_date: '24 January 2021', mission: 'High-resolution monitoring of methane emissions from industrial sites', status: 'Active' },
  { name: 'GHGSAT-C3', norad_id: 52737, tle1: '1 52737U 22057F   25299.29255694  .00008254  00000+0  28369-3 0  9998', tle2: '2 52737  97.6309  72.3450 0005850 222.3907 137.6881 15.30358230189714', operator: 'GHGSat Inc.', launch_date: '25 May 2022', mission: 'High-resolution monitoring of methane emissions from industrial sites', status: 'Active' },
  { name: 'TELSTAR 12V', norad_id: 41036, tle1: '1 41036U 15068A   25299.25715571 -.00000106  00000+0  00000+0 0  9990', tle2: '2 41036   0.0086 235.0891 0002075 335.4071 262.0014  1.00271824 36284', operator: 'Telesat Canada Ltd.', launch_date: '24 November 2015', mission: 'Geostationary communications (Ku/Ka-band) and maritime services', status: 'Active' },
  { name: 'TELSTAR 19V', norad_id: 43562, tle1: '1 43562U 18059A   25299.24762231 -.00000268  00000+0  00000+0 0  9992', tle2: '2 43562   0.0189 207.5968 0002652 319.9938 253.4558  1.00271404 26799', operator: 'Telesat Canada Ltd.', launch_date: '22 July 2018', mission: 'High-throughput geostationary communications for the Americas and North Atlantic', status: 'Active' },
  { name: 'MOST', norad_id: 27843, tle1: '1 27843U 03031D   25298.99624704  .00000119  00000+0  74900-4 0  9992', tle2: '2 27843  98.7084 304.9911 0009389 202.8505 157.2255 14.21250357157448', operator: 'CSA / UBC / UTAT', launch_date: '30 June 2003', mission: 'Microvariability and Oscillations of STars space telescope', status: 'Active' },
  { name: 'RCM-3', norad_id: 44323, tle1: '1 44323U 19033B   25299.25775890 -.00000137  00000+0 -78837-5 0  9992', tle2: '2 44323  97.7597 305.1540 0001516  90.5747 269.5646 14.92588364347209', operator: 'Canadian Space Agency (CSA)', launch_date: '12 June 2019', mission: 'RADARSAT Constellation Mission satellite 3 (maritime surveillance, disaster management)', status: 'Active' },
]

export const CLASS_COLOR: Record<OrbitClass, string> = {
  LEO: '#38bdf8',
  POLAR: '#2dd4bf',
  SSO: '#a78bfa',
  MEO: '#fbbf24',
  GEO: '#f472b6',
  HEO: '#fb923c',
}

export const CATALOG: CatalogSatellite[] = RAW.flatMap((r) => {
  const parsed = parseTle(`${r.name}\n${r.tle1}\n${r.tle2}`)
  if (!parsed.ok) {
    console.warn(`Catalog TLE for ${r.name} rejected:`, parsed.errors)
    return []
  }
  const elements = tleToElements(parsed.tle)
  const orbitClass = classifyOrbit(elements)
  return [
    {
      id: String(r.norad_id),
      name: r.name,
      noradId: r.norad_id,
      operator: r.operator,
      launchDate: r.launch_date,
      mission: r.mission,
      status: r.status,
      tle: parsed.tle,
      lines: parsed.lines,
      elements,
      orbitClass,
      color: CLASS_COLOR[orbitClass],
    },
  ]
})

export const catalogById = (id: string | null | undefined) => CATALOG.find((s) => s.id === id)