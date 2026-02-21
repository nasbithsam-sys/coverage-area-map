/**
 * Location spelling autocorrect utilities.
 * Maps common misspellings to correct US city names and state abbreviations.
 */

const STATE_NAMES: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
};

const VALID_ABBRS = new Set(Object.values(STATE_NAMES));

// Common city misspellings → correct spelling
const CITY_CORRECTIONS: Record<string, string> = {
  "huston": "Houston", "housten": "Houston", "houstin": "Houston",
  "dalls": "Dallas", "dalas": "Dallas",
  "phonix": "Phoenix", "pheonix": "Phoenix",
  "miamii": "Miami", "maimi": "Miami",
  "atlana": "Atlanta", "altanta": "Atlanta",
  "seatle": "Seattle", "seattl": "Seattle", "seattel": "Seattle",
  "chicgo": "Chicago", "chicagoo": "Chicago", "chigago": "Chicago",
  "denvar": "Denver", "denvor": "Denver",
  "bostan": "Boston", "bostom": "Boston",
  "san fran": "San Francisco", "sanfrancisco": "San Francisco",
  "detriot": "Detroit", "detrot": "Detroit",
  "minneapolls": "Minneapolis", "mineapolis": "Minneapolis",
  "portlnad": "Portland", "portand": "Portland",
  "nashvile": "Nashville", "nashvill": "Nashville",
  "charlote": "Charlotte", "charolette": "Charlotte", "charlott": "Charlotte",
  "las vagas": "Las Vegas", "las vegus": "Las Vegas",
  "colombus": "Columbus", "columbis": "Columbus",
  "fort woth": "Fort Worth", "forworth": "Fort Worth",
  "san antono": "San Antonio", "san antinio": "San Antonio",
  "austen": "Austin", "austn": "Austin",
  "arlinton": "Arlington", "arlingotn": "Arlington",
  "san deigo": "San Diego", "sandiego": "San Diego",
  "jacksonvile": "Jacksonville", "jaxsonville": "Jacksonville",
  "indianpolis": "Indianapolis", "indianopolis": "Indianapolis",
  "san hose": "San Jose", "sanjose": "San Jose",
  "philedelphia": "Philadelphia", "philadephia": "Philadelphia", "philly": "Philadelphia",
  "washingon": "Washington", "washinton": "Washington",
  "balitmore": "Baltimore", "baltmore": "Baltimore",
  "tamapa": "Tampa", "tamppa": "Tampa",
  "olrando": "Orlando", "oralndo": "Orlando",
  "sacremento": "Sacramento", "sacrimento": "Sacramento",
  "ralegh": "Raleigh", "raliegh": "Raleigh",
  "memphys": "Memphis", "memphs": "Memphis",
  "okalhoma city": "Oklahoma City", "oklohoma city": "Oklahoma City",
  "lousville": "Louisville", "louiville": "Louisville",
  "milwakee": "Milwaukee", "milwuakee": "Milwaukee",
  "tuscon": "Tucson", "tucsen": "Tucson",
  "albquerque": "Albuquerque", "albuqurque": "Albuquerque", "albequerque": "Albuquerque",
  "salt lke city": "Salt Lake City", "saltlakecity": "Salt Lake City",
  "el passo": "El Paso", "elpaso": "El Paso",
  "wacco": "Waco",
  "pittsburg": "Pittsburgh", "pitsberg": "Pittsburgh",
  "st louis": "St. Louis", "saint louis": "St. Louis",
  "new yourk": "New York", "newyork": "New York",
  "los angelas": "Los Angeles", "los angleles": "Los Angeles", "losangeles": "Los Angeles",
  "kansascity": "Kansas City", "kansas cty": "Kansas City",
};

// Common state abbreviation misspellings
const STATE_CORRECTIONS: Record<string, string> = {
  "te": "TX", "tx.": "TX", "tex": "TX",
  "ca.": "CA", "cal": "CA", "cali": "CA",
  "fl.": "FL", "fla": "FL",
  "ny.": "NY",
  "il.": "IL", "ill": "IL",
  "pa.": "PA", "penn": "PA",
  "oh.": "OH",
  "ga.": "GA",
  "nc.": "NC",
  "va.": "VA",
  "wa.": "WA", "wash": "WA",
  "az.": "AZ", "ariz": "AZ",
  "co.": "CO", "colo": "CO",
  "tn.": "TN", "tenn": "TN",
  "mo.": "MO",
  "mn.": "MN", "minn": "MN",
  "wi.": "WI", "wis": "WI",
  "or.": "OR", "ore": "OR",
  "nv.": "NV", "nev": "NV",
  "md.": "MD",
  "in.": "IN", "ind": "IN",
  "mi.": "MI", "mich": "MI",
  "ok.": "OK", "okla": "OK",
  "ky.": "KY",
  "nm.": "NM",
  "ne.": "NE", "neb": "NE",
  "ut.": "UT",
  "sc.": "SC",
};

/**
 * Correct common city name misspellings.
 * Returns the corrected city name or the original with proper casing.
 */
export function correctCitySpelling(city: string): string {
  const lower = city.toLowerCase().trim();
  if (CITY_CORRECTIONS[lower]) return CITY_CORRECTIONS[lower];
  // Title case the original
  return city.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Correct state abbreviation from full name or common misspellings.
 * Returns a valid 2-letter abbreviation or the original uppercased.
 */
export function correctStateSpelling(state: string): string {
  const upper = state.trim().toUpperCase();
  if (VALID_ABBRS.has(upper)) return upper;

  const lower = state.trim().toLowerCase();
  // Check full state name
  if (STATE_NAMES[lower]) return STATE_NAMES[lower];
  // Check common misspellings
  if (STATE_CORRECTIONS[lower]) return STATE_CORRECTIONS[lower];

  return upper;
}
