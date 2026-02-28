const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

// Parse user agent to extract device info
const parseUserAgent = (userAgent) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  const browser = result.browser.name 
    ? `${result.browser.name} ${result.browser.version || ''}`.trim()
    : 'Unknown Browser';
    
  const os = result.os.name
    ? `${result.os.name} ${result.os.version || ''}`.trim()
    : 'Unknown OS';
    
  const device = result.device.model || result.device.type || 'Desktop';
  const deviceVendor = result.device.vendor || '';
  
  const deviceName = deviceVendor 
    ? `${deviceVendor} ${device}`.trim()
    : device;
  
  return {
    browser,
    os,
    deviceName: deviceName || 'Unknown Device'
  };
};

// Get geolocation from IP
const getGeoLocation = (ip) => {
  // Handle localhost and private IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      country: 'Local',
      city: 'Local',
      region: 'Local'
    };
  }
  
  const geo = geoip.lookup(ip);
  
  if (!geo) {
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown'
    };
  }
  
  return {
    country: geo.country || 'Unknown',
    city: geo.city || 'Unknown',
    region: geo.region || 'Unknown'
  };
};

// Extract client IP from request
const getClientIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '0.0.0.0';
};

// Check if IP is in same range (simple check - first 3 octets for IPv4)
const isSameIPRange = (ip1, ip2) => {
  const parts1 = ip1.split('.');
  const parts2 = ip2.split('.');
  
  if (parts1.length !== 4 || parts2.length !== 4) {
    return ip1 === ip2; // For non-IPv4, exact match
  }
  
  // Check if first 3 octets match (same /24 subnet)
  return parts1[0] === parts2[0] && 
         parts1[1] === parts2[1] && 
         parts1[2] === parts2[2];
};

// Parse device info from request
const parseDeviceInfo = (req, options = {}) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = getClientIP(req);
  const geo = getGeoLocation(ip);
  const deviceInfo = parseUserAgent(userAgent);
  
  // If GPS coordinates provided, store them for more accurate location
  const result = {
    ...deviceInfo,
    ipAddress: ip,
    userAgent,
    country: geo.country,
    city: geo.city
  };
  
  // Override with GPS-based location if coordinates provided
  if (options.latitude && options.longitude) {
    result.latitude = options.latitude;
    result.longitude = options.longitude;
    result.locationSource = 'gps';
  } else {
    result.locationSource = 'ip';
  }
  
  return result;
};

module.exports = {
  parseUserAgent,
  getGeoLocation,
  getClientIP,
  isSameIPRange,
  parseDeviceInfo
};
