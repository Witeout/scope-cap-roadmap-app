/**
 * Built-in worldwide stat holiday database — 2025 through 2028.
 *
 * Each entry is { name, region, dates } where:
 *   - region: region code (e.g. 'CA', 'US', 'UK') or 'Global' (applies everywhere)
 *   - dates: object mapping year string → 'YYYY-MM-DD' date string
 *
 * Fixed-date holidays (e.g. Christmas Day) use the same MM-DD each year.
 * Floating holidays (e.g. Thanksgiving) have explicit per-year dates.
 *
 * To add a new region, add entries below and add the region to SUPPORTED_REGIONS.
 */

export const SUPPORTED_REGIONS = [
  { code: 'CA', label: 'Canada'         },
  { code: 'US', label: 'United States'  },
  { code: 'UK', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia'      },
  { code: 'FR', label: 'France'         },
  { code: 'DE', label: 'Germany'        },
]

// ─── Holiday entries ──────────────────────────────────────────────────────────
// Each entry: { name, region, dates: { '2025': 'YYYY-MM-DD', ... } }
const RAW_HOLIDAYS = [
  // ── Global ────────────────────────────────────────────────────────────────
  { name: "New Year's Day",   region: 'Global', dates: { '2025': '2025-01-01', '2026': '2026-01-01', '2027': '2027-01-01', '2028': '2028-01-01' } },
  { name: 'Christmas Day',    region: 'Global', dates: { '2025': '2025-12-25', '2026': '2026-12-25', '2027': '2027-12-25', '2028': '2028-12-25' } },

  // ── Canada (CA) ───────────────────────────────────────────────────────────
  // Family Day — 3rd Monday of February (most provinces)
  { name: 'Family Day',           region: 'CA', dates: { '2025': '2025-02-17', '2026': '2026-02-16', '2027': '2027-02-15', '2028': '2028-02-17' } },
  // Good Friday
  { name: 'Good Friday',          region: 'CA', dates: { '2025': '2025-04-18', '2026': '2026-04-03', '2027': '2027-03-26', '2028': '2028-04-14' } },
  // Victoria Day — Monday before May 25
  { name: 'Victoria Day',         region: 'CA', dates: { '2025': '2025-05-19', '2026': '2026-05-18', '2027': '2027-05-24', '2028': '2028-05-22' } },
  // Canada Day — July 1
  { name: 'Canada Day',           region: 'CA', dates: { '2025': '2025-07-01', '2026': '2026-07-01', '2027': '2027-07-01', '2028': '2028-07-02' } },
  // Civic Holiday — 1st Monday of August (BC, AB, ON, SK, MB, NB)
  { name: 'Civic Holiday',        region: 'CA', dates: { '2025': '2025-08-04', '2026': '2026-08-03', '2027': '2027-08-02', '2028': '2028-08-07' } },
  // Labour Day — 1st Monday of September
  { name: 'Labour Day',           region: 'CA', dates: { '2025': '2025-09-01', '2026': '2026-09-07', '2027': '2027-09-06', '2028': '2028-09-04' } },
  // Thanksgiving — 2nd Monday of October
  { name: 'Thanksgiving (CA)',    region: 'CA', dates: { '2025': '2025-10-13', '2026': '2026-10-12', '2027': '2027-10-11', '2028': '2028-10-09' } },
  // Remembrance Day — November 11
  { name: 'Remembrance Day',      region: 'CA', dates: { '2025': '2025-11-11', '2026': '2026-11-11', '2027': '2027-11-11', '2028': '2028-11-13' } },
  // Boxing Day — December 26
  { name: 'Boxing Day',           region: 'CA', dates: { '2025': '2025-12-26', '2026': '2026-12-28', '2027': '2027-12-27', '2028': '2028-12-26' } },

  // ── United States (US) ────────────────────────────────────────────────────
  // MLK Day — 3rd Monday of January
  { name: 'Martin Luther King Jr. Day', region: 'US', dates: { '2025': '2025-01-20', '2026': '2026-01-19', '2027': '2027-01-18', '2028': '2028-01-17' } },
  // Presidents' Day — 3rd Monday of February
  { name: "Presidents' Day",      region: 'US', dates: { '2025': '2025-02-17', '2026': '2026-02-16', '2027': '2027-02-15', '2028': '2028-02-21' } },
  // Memorial Day — last Monday of May
  { name: 'Memorial Day',         region: 'US', dates: { '2025': '2025-05-26', '2026': '2026-05-25', '2027': '2027-05-31', '2028': '2028-05-29' } },
  // Juneteenth — June 19
  { name: 'Juneteenth',           region: 'US', dates: { '2025': '2025-06-19', '2026': '2026-06-19', '2027': '2027-06-19', '2028': '2028-06-19' } },
  // Independence Day — July 4
  { name: 'Independence Day',     region: 'US', dates: { '2025': '2025-07-04', '2026': '2026-07-04', '2027': '2027-07-05', '2028': '2028-07-04' } },
  // Labour Day — 1st Monday of September
  { name: 'Labor Day',            region: 'US', dates: { '2025': '2025-09-01', '2026': '2026-09-07', '2027': '2027-09-06', '2028': '2028-09-04' } },
  // Columbus / Indigenous Peoples' Day — 2nd Monday of October
  { name: "Columbus / Indigenous Peoples' Day", region: 'US', dates: { '2025': '2025-10-13', '2026': '2026-10-12', '2027': '2027-10-11', '2028': '2028-10-09' } },
  // Veterans Day — November 11
  { name: 'Veterans Day',         region: 'US', dates: { '2025': '2025-11-11', '2026': '2026-11-11', '2027': '2027-11-11', '2028': '2028-11-12' } },
  // Thanksgiving — 4th Thursday of November
  { name: 'Thanksgiving (US)',    region: 'US', dates: { '2025': '2025-11-27', '2026': '2026-11-26', '2027': '2027-11-25', '2028': '2028-11-23' } },

  // ── United Kingdom (UK) ───────────────────────────────────────────────────
  // New Year's Day (observed) — same as Global but UK observes Monday if Jan 1 is weekend
  { name: "New Year's Day (observed)", region: 'UK', dates: { '2025': '2025-01-01', '2026': '2026-01-01', '2027': '2027-01-01', '2028': '2028-01-03' } },
  // Good Friday
  { name: 'Good Friday',          region: 'UK', dates: { '2025': '2025-04-18', '2026': '2026-04-03', '2027': '2027-03-26', '2028': '2028-04-14' } },
  // Easter Monday
  { name: 'Easter Monday',        region: 'UK', dates: { '2025': '2025-04-21', '2026': '2026-04-06', '2027': '2027-03-29', '2028': '2028-04-17' } },
  // Early May Bank Holiday — 1st Monday of May
  { name: 'Early May Bank Holiday',   region: 'UK', dates: { '2025': '2025-05-05', '2026': '2026-05-04', '2027': '2027-05-03', '2028': '2028-05-07' } },
  // Spring Bank Holiday — last Monday of May
  { name: 'Spring Bank Holiday',  region: 'UK', dates: { '2025': '2025-05-26', '2026': '2026-05-25', '2027': '2027-05-31', '2028': '2028-05-27' } },
  // Summer Bank Holiday — last Monday of August
  { name: 'Summer Bank Holiday',  region: 'UK', dates: { '2025': '2025-08-25', '2026': '2026-08-31', '2027': '2027-08-30', '2028': '2028-08-28' } },
  // Boxing Day — December 26
  { name: 'Boxing Day',           region: 'UK', dates: { '2025': '2025-12-26', '2026': '2026-12-28', '2027': '2027-12-27', '2028': '2028-12-26' } },

  // ── Australia (AU) ────────────────────────────────────────────────────────
  // Australia Day — January 26 (observed Monday if on weekend)
  { name: 'Australia Day',        region: 'AU', dates: { '2025': '2025-01-27', '2026': '2026-01-26', '2027': '2027-01-26', '2028': '2028-01-26' } },
  // Good Friday
  { name: 'Good Friday',          region: 'AU', dates: { '2025': '2025-04-18', '2026': '2026-04-03', '2027': '2027-03-26', '2028': '2028-04-14' } },
  // Easter Saturday
  { name: 'Easter Saturday',      region: 'AU', dates: { '2025': '2025-04-19', '2026': '2026-04-04', '2027': '2027-03-27', '2028': '2028-04-15' } },
  // Easter Monday
  { name: 'Easter Monday',        region: 'AU', dates: { '2025': '2025-04-21', '2026': '2026-04-06', '2027': '2027-03-29', '2028': '2028-04-17' } },
  // ANZAC Day — April 25
  { name: 'ANZAC Day',            region: 'AU', dates: { '2025': '2025-04-25', '2026': '2026-04-25', '2027': '2027-04-26', '2028': '2028-04-25' } },
  // Boxing Day — December 26
  { name: 'Boxing Day',           region: 'AU', dates: { '2025': '2025-12-26', '2026': '2026-12-28', '2027': '2027-12-27', '2028': '2028-12-26' } },

  // ── France (FR) ───────────────────────────────────────────────────────────
  // Easter Monday
  { name: 'Easter Monday',        region: 'FR', dates: { '2025': '2025-04-21', '2026': '2026-04-06', '2027': '2027-03-29', '2028': '2028-04-17' } },
  // Labour Day / Fête du Travail — May 1
  { name: 'Fête du Travail',      region: 'FR', dates: { '2025': '2025-05-01', '2026': '2026-05-01', '2027': '2027-05-01', '2028': '2028-05-01' } },
  // Victory in Europe Day — May 8
  { name: 'Fête de la Victoire',  region: 'FR', dates: { '2025': '2025-05-08', '2026': '2026-05-08', '2027': '2027-05-08', '2028': '2028-05-08' } },
  // Ascension Day — 39 days after Easter
  { name: 'Ascension',            region: 'FR', dates: { '2025': '2025-05-29', '2026': '2026-05-14', '2027': '2027-05-06', '2028': '2028-05-25' } },
  // Whit Monday — 50 days after Easter
  { name: 'Lundi de Pentecôte',   region: 'FR', dates: { '2025': '2025-06-09', '2026': '2026-05-25', '2027': '2027-05-17', '2028': '2028-06-05' } },
  // Bastille Day — July 14
  { name: 'Fête Nationale',       region: 'FR', dates: { '2025': '2025-07-14', '2026': '2026-07-14', '2027': '2027-07-14', '2028': '2028-07-14' } },
  // Assumption of Mary — August 15
  { name: "Assomption",           region: 'FR', dates: { '2025': '2025-08-15', '2026': '2026-08-15', '2027': '2027-08-15', '2028': '2028-08-15' } },
  // All Saints' Day — November 1
  { name: 'Toussaint',            region: 'FR', dates: { '2025': '2025-11-01', '2026': '2026-11-01', '2027': '2027-11-01', '2028': '2028-11-01' } },
  // Armistice Day — November 11
  { name: 'Armistice',            region: 'FR', dates: { '2025': '2025-11-11', '2026': '2026-11-11', '2027': '2027-11-11', '2028': '2028-11-11' } },

  // ── Germany (DE) ─────────────────────────────────────────────────────────
  // Good Friday
  { name: 'Karfreitag',           region: 'DE', dates: { '2025': '2025-04-18', '2026': '2026-04-03', '2027': '2027-03-26', '2028': '2028-04-14' } },
  // Easter Monday
  { name: 'Ostermontag',          region: 'DE', dates: { '2025': '2025-04-21', '2026': '2026-04-06', '2027': '2027-03-29', '2028': '2028-04-17' } },
  // Labour Day — May 1
  { name: 'Tag der Arbeit',       region: 'DE', dates: { '2025': '2025-05-01', '2026': '2026-05-01', '2027': '2027-05-01', '2028': '2028-05-01' } },
  // Ascension Day
  { name: 'Christi Himmelfahrt',  region: 'DE', dates: { '2025': '2025-05-29', '2026': '2026-05-14', '2027': '2027-05-06', '2028': '2028-05-25' } },
  // Whit Monday
  { name: 'Pfingstmontag',        region: 'DE', dates: { '2025': '2025-06-09', '2026': '2026-05-25', '2027': '2027-05-17', '2028': '2028-06-05' } },
  // German Unity Day — October 3
  { name: 'Tag der Deutschen Einheit', region: 'DE', dates: { '2025': '2025-10-03', '2026': '2026-10-03', '2027': '2027-10-03', '2028': '2028-10-03' } },
  // Boxing Day — December 26
  { name: '2. Weihnachtstag',     region: 'DE', dates: { '2025': '2025-12-26', '2026': '2026-12-26', '2027': '2027-12-26', '2028': '2028-12-26' } },
]

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns flat array of holiday objects for the given regions + Global,
 * covering all years in [fromYear, toYear].
 *
 * Each returned object: { id, name, region, startDate, endDate }
 */
export function getHolidaysForRegions(regions = [], fromYear = 2025, toYear = 2028) {
  const activeSet = new Set(regions)
  const results = []

  for (const entry of RAW_HOLIDAYS) {
    if (entry.region !== 'Global' && !activeSet.has(entry.region)) continue

    for (let y = fromYear; y <= toYear; y++) {
      const dateStr = entry.dates?.[String(y)]
      if (!dateStr) continue
      results.push({
        id:        `db-${entry.region}-${y}-${entry.name.replace(/\s+/g, '_')}`,
        name:      entry.name,
        region:    entry.region,
        startDate: dateStr,
        endDate:   dateStr,
        source:    'db',  // distinguish from user custom holidays
      })
    }
  }

  // Sort by date
  return results.sort((a, b) => a.startDate.localeCompare(b.startDate))
}
