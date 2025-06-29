# TooHot Restaurant MCP Protocol Documentation

## Overview

The TooHot Restaurant MCP (Model Context Protocol) provides AI chatbot integration for seamless reservation management. This protocol allows your AI assistant to check availability, create reservations, lookup existing bookings, and handle cancellations on behalf of customers.

## Base URL
```
Production: https://admin.toohot.kitchen/api/mcp
Development: http://localhost:3000/api/mcp
```

## Authentication
All MCP endpoints use server-side authentication via environment variables. No additional authentication is required from the AI chatbot.

---

## 🔍 **1. Check Availability**

Check if tables are available for specific date, time, and party size.

### Endpoint
```
POST /api/mcp/check-availability
```

### Request Body
```json
{
  "date": "2024-01-15",           // YYYY-MM-DD format
  "time": "19:00",               // HH:MM format (17:00 or 19:00)
  "party_size": 4,               // Number of guests (1-15)
  "type": "omakase"              // "omakase" or "dining" (optional, defaults to "omakase")
}
```

### Response
```json
{
  "available": true,
  "date": "2024-01-15",
  "time": "19:00",
  "party_size": 4,
  "type": "omakase",
  "capacity_info": {
    "requested": 4,
    "available": 8,
    "total": 12
  },
  "alternative_times": ["17:00"],
  "message": "Table available for 4 guests"
}
```

### Error Response
```json
{
  "available": false,
  "reason": "Not enough capacity. 2 seats available.",
  "alternative_times": ["17:00"],
  "capacity_info": {
    "requested": 4,
    "available": 2,
    "total": 12
  }
}
```

---

## 📝 **2. Create Reservation**

Create a new reservation with automatic confirmation and email sending.

### Endpoint
```
POST /api/mcp/create-reservation
```

### Request Body
```json
{
  "customer_name": "John Smith",
  "customer_email": "john@example.com",
  "customer_phone": "+1-555-123-4567",
  "reservation_date": "2024-01-15",    // YYYY-MM-DD format
  "reservation_time": "19:00",         // HH:MM format
  "party_size": 4,                     // 1-15 guests
  "type": "omakase",                   // "omakase" or "dining" (optional)
  "special_requests": "Vegetarian options needed", // Optional
  "notes": "VIP customer"              // Optional internal notes
}
```

### Success Response
```json
{
  "success": true,
  "reservation": {
    "id": "uuid-string",
    "confirmation_code": "ABC12345",
    "customer_name": "John Smith",
    "customer_email": "john@example.com",
    "reservation_date": "2024-01-15",
    "reservation_time": "19:00",
    "party_size": 4,
    "type": "omakase",
    "status": "confirmed",
    "special_requests": "Vegetarian options needed"
  },
  "message": "Reservation confirmed for John Smith on 2024-01-15 at 19:00",
  "confirmation_email_sent": true
}
```

### Error Response
```json
{
  "error": "Time slot not available",
  "availability_info": {
    "available": false,
    "capacity_info": {
      "requested": 4,
      "available": 2,
      "total": 12
    }
  },
  "suggested_alternatives": ["17:00"]
}
```

---

## 🔎 **3. Get Reservation**

Lookup existing reservations by confirmation code, email, or phone number.

### Endpoint
```
POST /api/mcp/get-reservation
GET /api/mcp/get-reservation?confirmation_code=ABC12345
```

### Request Body (POST)
```json
{
  "confirmation_code": "ABC12345",     // Optional
  "email": "john@example.com",         // Optional
  "phone": "+1-555-123-4567"          // Optional
}
```

### Success Response
```json
{
  "found": true,
  "count": 1,
  "reservations": [
    {
      "id": "uuid-string",
      "confirmation_code": "ABC12345",
      "customer_name": "John Smith",
      "customer_email": "john@example.com",
      "customer_phone": "+1-555-123-4567",
      "reservation_date": "2024-01-15",
      "reservation_time": "19:00",
      "party_size": 4,
      "type": "omakase",
      "status": "confirmed",
      "special_requests": "Vegetarian options needed",
      "notes": "",
      "created_at": "2024-01-01T10:00:00Z",
      "cancellation_reason": null,
      "duration_minutes": null
    }
  ],
  "message": "Found 1 reservation(s)",
  "search_criteria": {
    "confirmation_code": "ABC12345"
  }
}
```

### Not Found Response
```json
{
  "found": false,
  "message": "No reservations found with the provided information",
  "search_criteria": {
    "confirmation_code": "ABC12345"
  }
}
```

---

## ❌ **4. Cancel Reservation**

Cancel an existing reservation and send cancellation email.

### Endpoint
```
POST /api/mcp/cancel-reservation
```

### Request Body
```json
{
  "confirmation_code": "ABC12345",
  "reason": "Customer requested cancellation",  // Optional
  "customer_email": "john@example.com"         // Optional for verification
}
```

### Success Response
```json
{
  "success": true,
  "message": "Reservation ABC12345 has been successfully cancelled",
  "reservation": {
    "id": "uuid-string",
    "confirmation_code": "ABC12345",
    "customer_name": "John Smith",
    "customer_email": "john@example.com",
    "reservation_date": "2024-01-15",
    "reservation_time": "19:00",
    "party_size": 4,
    "type": "omakase",
    "status": "cancelled",
    "cancellation_reason": "Customer requested cancellation"
  },
  "cancellation_email_sent": true,
  "cancelled_at": "2024-01-01T15:30:00Z"
}
```

### Error Response
```json
{
  "error": "Reservation not found",
  "confirmation_code": "ABC12345"
}
```

---

## 📚 **AI Chatbot Integration Examples**

### Example 1: Making a Reservation
```javascript
// 1. First check availability
const availabilityResponse = await fetch('/api/mcp/check-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: '2024-01-15',
    time: '19:00',
    party_size: 4,
    type: 'omakase'
  })
});

const availability = await availabilityResponse.json();

if (availability.available) {
  // 2. Create the reservation
  const reservationResponse = await fetch('/api/mcp/create-reservation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'John Smith',
      customer_email: 'john@example.com',
      customer_phone: '+1-555-123-4567',
      reservation_date: '2024-01-15',
      reservation_time: '19:00',
      party_size: 4,
      type: 'omakase',
      special_requests: 'Celebrating anniversary'
    })
  });

  const reservation = await reservationResponse.json();
  // Return confirmation to customer
}
```

### Example 2: Looking Up a Reservation
```javascript
const lookupResponse = await fetch('/api/mcp/get-reservation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    confirmation_code: 'ABC12345'
  })
});

const result = await lookupResponse.json();

if (result.found) {
  const reservation = result.reservations[0];
  // Display reservation details to customer
}
```

---

## 🎯 **Business Rules**

### Reservation Types
- **Omakase**: 11-course tasting menu, $99/person, 2-hour experience
- **Dining**: À la carte menu, flexible pricing, 60-90 minute duration

### Time Slots
- **17:00** (5:00 PM)
- **19:00** (7:00 PM)

### Capacity Limits
- **Omakase**: 12 seats maximum
- **Dining**: 40 seats maximum

### Validation Rules
- Party size: 1-15 guests
- Advance booking: No past dates
- Email format validation
- Phone number cleaning and validation

### Status Workflow
1. **pending** → Manual confirmation required
2. **confirmed** → Ready for service
3. **seated** → Customer has arrived
4. **completed** → Service finished
5. **cancelled** → Reservation cancelled
6. **no-show** → Customer didn't arrive

---

## 🔒 **Error Handling**

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation errors)
- `404` - Reservation not found
- `409` - Conflict (time slot unavailable)
- `500` - Internal server error

### Common Error Types
```json
// Validation Error
{
  "error": "Missing required field: customer_email"
}

// Availability Error
{
  "error": "Time slot not available",
  "suggested_alternatives": ["17:00"]
}

// Not Found Error
{
  "error": "Reservation not found",
  "confirmation_code": "ABC12345"
}
```

---

## 🚀 **Getting Started**

1. **Test Availability**: Always check availability before attempting to create reservations
2. **Handle Errors**: Implement proper error handling for all edge cases
3. **Use Alternatives**: When time slots are unavailable, suggest alternative times
4. **Validate Input**: Ensure all required fields are provided and properly formatted
5. **Confirm Success**: Always confirm successful operations to customers

### Sample AI Chatbot Flow
```
Customer: "I'd like to make a reservation for 4 people on January 15th at 7pm"

1. Parse request: date=2024-01-15, time=19:00, party_size=4
2. Check availability via MCP
3. If available, collect customer details
4. Create reservation via MCP
5. Confirm with customer and provide confirmation code

Customer: "What's my reservation details for confirmation ABC12345?"

1. Lookup reservation via MCP
2. Display reservation details
3. Offer options to modify or cancel if needed
```

---

## 📞 **Support**

For technical issues or questions about the MCP protocol:
- **Documentation**: This file
- **API Testing**: Use tools like Postman or curl to test endpoints
- **Error Logs**: Check server logs for detailed error information

---

*Built with ❤️ for TooHot Restaurant's AI-powered customer service* 