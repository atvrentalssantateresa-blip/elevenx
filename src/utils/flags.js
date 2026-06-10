// Country name to flag emoji mapping for World Cup 2026 teams
const COUNTRY_FLAGS = {
  // North America (Hosts)
  'mexico': '🇲🇽',
  'usa': '🇺🇸',
  'united states': '🇺🇸',
  'canada': '🇨🇦',
  
  // Europe
  'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'france': '🇫🇷',
  'germany': '🇩🇪',
  'spain': '🇪🇸',
  'portugal': '🇵🇹',
  'netherlands': '🇳🇱',
  'belgium': '🇧🇪',
  'croatia': '🇭🇷',
  'switzerland': '🇨🇭',
  'denmark': '🇩🇰',
  'serbia': '🇷🇸',
  'poland': '🇵🇱',
  'sweden': '🇸🇪',
  'norway': '🇳🇴',
  'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'ireland': '🇮🇪',
  'italy': '🇮🇹',
  'austria': '🇦🇹',
  'czechia': '🇨🇿',
  'czech republic': '🇨🇿',
  'ukraine': '🇺🇦',
  'romania': '🇷🇴',
  'hungary': '🇭🇺',
  'turkey': '🇹🇷',
  'greece': '🇬🇷',
  'slovakia': '🇸🇰',
  'slovenia': '🇸🇮',
  'finland': '🇫🇮',
  'iceland': '🇮🇸',
  'bosnia and herzegovina': '🇧🇦',
  'bosnia & herzegovina': '🇧🇦',
  'bosnia': '🇧🇦',
  
  // South America
  'brazil': '🇧🇷',
  'argentina': '🇦🇷',
  'uruguay': '🇺🇾',
  'colombia': '🇨🇴',
  'chile': '🇨🇱',
  'ecuador': '🇪🇨',
  'paraguay': '🇵🇾',
  'peru': '🇵🇪',
  'venezuela': '🇻🇪',
  'bolivia': '🇧🇴',
  
  // Africa
  'morocco': '🇲🇦',
  'senegal': '🇸🇳',
  'tunisia': '🇹🇳',
  'egypt': '🇪🇬',
  'nigeria': '🇳🇬',
  'cameroon': '🇨🇲',
  'ghana': '🇬🇭',
  'ivory coast': '🇨🇮',
  'côte d\'ivoire': '🇨🇮',
  'cote d\'ivoire': '🇨🇮',
  'south africa': '🇿🇦',
  'algeria': '🇩🇿',
  'mali': '🇲🇱',
  'burkina faso': '🇧🇫',
  'guinea': '🇬🇳',
  'cape verde': '🇨🇻',
  'congo': '🇨🇬',
  'dr congo': '🇨🇩',
  'gabon': '🇬🇦',
  'benin': '🇧🇯',
  'madagascar': '🇲🇬',
  'mauritania': '🇲🇷',
  'niger': '🇳🇪',
  'zambia': '🇿🇲',
  'zimbabwe': '🇿🇼',
  'mozambique': '🇲🇿',
  'angola': '🇦🇴',
  'botswana': '🇧🇼',
  'namibia': '🇳🇦',
  
  // Asia
  'japan': '🇯🇵',
  'south korea': '🇰🇷',
  'korea republic': '🇰🇷',
  'iran': '🇮🇷',
  'saudi arabia': '🇸🇦',
  'australia': '🇦🇺',
  'qatar': '🇶🇦',
  'uae': '🇦🇪',
  'united arab emirates': '🇦🇪',
  'iraq': '🇮🇶',
  'uzbekistan': '🇺🇿',
  'china': '🇨🇳',
  'jordan': '🇯🇴',
  'oman': '🇴🇲',
  'palestine': '🇵🇸',
  'lebanon': '🇱🇧',
  'syria': '🇸🇾',
  'yemen': '🇾🇪',
  'india': '🇮🇳',
  'thailand': '🇹🇭',
  'vietnam': '🇻🇳',
  'malaysia': '🇲🇾',
  'singapore': '🇸🇬',
  'indonesia': '🇮🇩',
  'philippines': '🇵🇭',
  
  // Oceania
  'new zealand': '🇳🇿',
  'fiji': '🇫🇯',
  'papua new guinea': '🇵🇬',
  
  // Caribbean / Central America
  'jamaica': '🇯🇲',
  'costa rica': '🇨🇷',
  'panama': '🇵🇦',
  'honduras': '🇭🇳',
  'guatemala': '🇬🇹',
  'el salvador': '🇸🇻',
  'nicaragua': '🇳🇮',
  'trinidad and tobago': '🇹🇹',
  'haiti': '🇭🇹',
  'cuba': '🇨🇺',
  'curacao': '🇨🇼',
  'curaçao': '🇨🇼',
  'barbados': '🇧🇧',
  
  // Special characters / alternate spellings
  'türkiye': '🇹🇷',
  'turkey': '🇹🇷',
  'côte d\'ivoire': '🇨🇮',
  'cote d\'ivoire': '🇨🇮',
};

// Country code to flag emoji mapping (for 2-letter and special codes)
const CODE_FLAGS = {
  'MX': '🇲🇽',
  'ZA': '🇿🇦',
  'KR': '🇰🇷',
  'CZ': '🇨🇿',
  'CA': '🇨🇦',
  'BA': '🇧🇦',
  'QA': '🇶🇦',
  'CH': '🇨🇭',
  'US': '🇺🇸',
  'PY': '🇵🇾',
  'AU': '🇦🇺',
  'TR': '🇹🇷',
  'BR': '🇧🇷',
  'MA': '🇲🇦',
  'HT': '🇭🇹',
  'GB-SCT': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'DE': '🇩🇪',
  'CW': '🇨🇼',
  'CI': '🇨🇮',
  'EC': '🇪🇨',
  'NL': '🇳🇱',
  'JP': '🇯🇵',
  'SE': '🇸🇪',
  'TN': '🇹🇳',
  'BE': '🇧🇪',
  'EG': '🇪🇬',
  'IR': '🇮🇷',
  'NZ': '🇳🇿',
  'ES': '🇪🇸',
  'CV': '🇨🇻',
  'SA': '🇸🇦',
  'UY': '🇺🇾',
  'FR': '🇫🇷',
  'SN': '🇸🇳',
  'IQ': '🇮🇶',
  'NO': '🇳🇴',
  'AR': '🇦🇷',
  'DZ': '🇩🇿',
  'AT': '🇦🇹',
  'JO': '🇯🇴',
  'PT': '🇵🇹',
  'CD': '🇨🇩',
  'CO': '🇨🇴',
  'UZ': '🇺🇿',
  'GB-ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'HR': '🇭🇷',
  'GH': '🇬🇭',
  'PA': '🇵🇦',
};

// Convert country code to emoji flag
export const getFlagEmoji = (countryCode) => {
  if (!countryCode) return '🏳️';
  const upperCode = countryCode.toUpperCase();
  // Check direct mapping first for special cases
  if (CODE_FLAGS[upperCode]) return CODE_FLAGS[upperCode];
  // Fallback to unicode conversion for standard 2-letter codes
  const codePoints = upperCode
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
};

// Get flag emoji from country name
export const getFlagFromName = (countryName) => {
  if (!countryName) return '🏳️';
  const normalizedName = countryName.toLowerCase().trim();
  return COUNTRY_FLAGS[normalizedName] || '🏳️';
};

// Country name to 2-letter code mapping (for display when emojis don't render)
const COUNTRY_CODES = {
  'mexico': 'MX', 'usa': 'US', 'united states': 'US', 'canada': 'CA',
  'england': 'EN', 'france': 'FR', 'germany': 'DE', 'spain': 'ES', 'portugal': 'PT',
  'netherlands': 'NL', 'belgium': 'BE', 'croatia': 'HR', 'switzerland': 'CH',
  'denmark': 'DK', 'serbia': 'RS', 'poland': 'PL', 'sweden': 'SE', 'wales': 'WA',
  'italy': 'IT', 'austria': 'AT', 'czechia': 'CZ', 'czech republic': 'CZ',
  'ukraine': 'UA', 'bosnia and herzegovina': 'BA', 'bosnia & herzegovina': 'BA',
  'brazil': 'BR', 'argentina': 'AR', 'uruguay': 'UY', 'colombia': 'CO', 'chile': 'CL',
  'ecuador': 'EC', 'paraguay': 'PY', 'peru': 'PE',
  'morocco': 'MA', 'senegal': 'SN', 'tunisia': 'TN', 'egypt': 'EG', 'nigeria': 'NG',
  'cameroon': 'CM', 'ghana': 'GH', 'south africa': 'ZA', 'algeria': 'DZ',
  'japan': 'JP', 'south korea': 'KR', 'korea republic': 'KR', 'iran': 'IR',
  'saudi arabia': 'SA', 'australia': 'AU', 'qatar': 'QA', 'uzbekistan': 'UZ',
  'jordan': 'JO', 'panama': 'PA', 'jamaica': 'JM', 'costa rica': 'CR',
};

// Get country code from team name
const getCountryCode = (teamName) => {
  if (!teamName) return '';
  return COUNTRY_CODES[teamName.toLowerCase().trim()] || teamName.substring(0, 2).toUpperCase();
};

// Get flag for team (handles both name and country code) - now returns country codes as visual fallback
export const getTeamFlag = (teamName, countryCode) => {
  // Try to use emoji first, but if it doesn't work well, fallback to country code display
  if (countryCode) {
    return getCountryCode(teamName) || countryCode;
  }
  if (teamName) {
    return getCountryCode(teamName);
  }
  return '??';
};