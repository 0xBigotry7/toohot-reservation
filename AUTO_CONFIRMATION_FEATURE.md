# TooHot Auto-Confirmation Feature

## Overview

The Auto-Confirmation feature allows restaurant owners to configure which reservation types should be automatically confirmed without manual approval. This streamlines operations while maintaining full control over the reservation workflow.

## ✨ **Key Benefits**

- 🚀 **Faster Customer Service**: Auto-confirmed reservations send immediate confirmations
- ⚙️ **Flexible Configuration**: Choose auto-confirmation per reservation type
- 📧 **Smart Email Logic**: Skip owner notifications for auto-confirmed types
- 🔄 **Workflow Preservation**: Maintains existing reservation management capabilities
- 💼 **Business Intelligence**: Different approaches for different service levels

---

## 🎯 **How It Works**

### **Auto-Confirmation Enabled**
```
Customer Books → Auto-Confirmed → Customer Gets Confirmation Email
                      ↓
               (No owner action needed)
```

### **Manual Confirmation Required**
```
Customer Books → Pending Status → Owner Notification → Manual Approval → Customer Confirmation
```

---

## ⚙️ **Configuration**

### **Environment Variables**

Add these to your `.env.local` file:

```bash
# Server-side settings (used by API)
AUTO_CONFIRM_OMAKASE=false
AUTO_CONFIRM_DINING=true

# Client-side settings (used by admin dashboard)
NEXT_PUBLIC_AUTO_CONFIRM_OMAKASE=false
NEXT_PUBLIC_AUTO_CONFIRM_DINING=true
```

### **Recommended Settings**

**Typical Restaurant Setup:**
- **Omakase**: `false` (manual confirmation for high-value $99 reservations)
- **À la Carte Dining**: `true` (auto-confirm for flexible dining)

**High-Volume Restaurant:**
- **Both types**: `true` (auto-confirm everything for maximum efficiency)

**Exclusive Restaurant:**
- **Both types**: `false` (manual approval for all reservations)

---

## 🖥️ **Admin Dashboard**

### **Settings Interface**

1. **Access Settings**: Click the ⚙️ Settings button in the admin header
2. **Toggle Auto-Confirmation**: Use the switches for each reservation type
3. **Save Settings**: Click "Save Settings" to apply changes

### **Visual Indicators**

The settings modal shows:
- ✅ **Auto-confirmed**: "Automatically confirmed - no manual approval needed"
- ⏳ **Manual confirmation**: "Requires manual confirmation - will remain pending until approved"

### **Real-time Feedback**

When creating reservations:
- **Auto-confirmed types**: Immediately show as "confirmed" with customer email sent
- **Manual types**: Show as "pending" until owner approves

---

## 📧 **Email Workflows**

### **Auto-Confirmed Reservations**
1. Customer books reservation
2. System automatically sets status to "confirmed"
3. Customer receives confirmation email immediately
4. Owner receives no action-required notification

### **Manual Confirmation Reservations**
1. Customer books reservation  
2. System sets status to "pending"
3. Owner receives notification (when implemented)
4. After manual approval, customer receives confirmation email

---

## 🔧 **Technical Implementation**

### **API Logic**

```javascript
// Auto-confirmation settings
const autoConfirmOmakase = process.env.AUTO_CONFIRM_OMAKASE === 'true';
const autoConfirmDining = process.env.AUTO_CONFIRM_DINING === 'true';

// Determine initial status
const shouldAutoConfirm = reservationType === 'omakase' ? autoConfirmOmakase : autoConfirmDining;
const initialStatus = shouldAutoConfirm ? 'confirmed' : 'pending';
```

### **Email Logic**

```javascript
if (data.status === 'confirmed') {
  // Send customer confirmation email
  await sendCustomerConfirmation({...});
} else if (data.status === 'pending' && !shouldAutoConfirm) {
  // Send owner notification for manual confirmation needed
  console.log('Owner notification needed');
}
```

---

## 🎮 **Usage Examples**

### **Scenario 1: Mixed Auto-Confirmation**
```bash
AUTO_CONFIRM_OMAKASE=false
AUTO_CONFIRM_DINING=true
```

**Result:**
- Omakase reservations → Pending (manual approval needed)
- Dining reservations → Auto-confirmed (immediate confirmation)

### **Scenario 2: Full Automation**
```bash
AUTO_CONFIRM_OMAKASE=true
AUTO_CONFIRM_DINING=true
```

**Result:**
- All reservations → Auto-confirmed
- Maximum efficiency, minimal manual work

### **Scenario 3: Full Manual Control**
```bash
AUTO_CONFIRM_OMAKASE=false
AUTO_CONFIRM_DINING=false
```

**Result:**
- All reservations → Pending (manual approval for everything)
- Maximum control, traditional workflow

---

## 🔍 **Monitoring & Analytics**

### **Log Messages**

Auto-confirmed reservations:
```
Auto-confirmed omakase reservation - customer confirmation sent: [ID]
Auto-confirmed dining reservation - customer confirmation sent: [ID]
```

Manual confirmation needed:
```
Pending omakase reservation created - owner notification needed: [ID]
Pending dining reservation created - owner notification needed: [ID]
```

### **Dashboard Indicators**

- **Confirmed reservations**: Show with green status badge
- **Pending reservations**: Show with yellow status badge requiring action
- **Statistics**: Include both auto and manually confirmed in revenue calculations

---

## 🚀 **Best Practices**

### **For High-End Restaurants**
- Keep omakase manual confirmation for quality control
- Auto-confirm casual dining for efficiency

### **For High-Volume Restaurants** 
- Auto-confirm both types to reduce workload
- Monitor reservation quality through other metrics

### **For New Restaurants**
- Start with manual confirmation to understand customer patterns
- Gradually move to auto-confirmation as confidence grows

### **For Special Events**
- Temporarily disable auto-confirmation during busy periods
- Ensure adequate staffing for manual confirmation workflows

---

## ⚠️ **Important Notes**

1. **Workflow Preservation**: Auto-confirmation doesn't change existing reservation management capabilities
2. **Manual Override**: Owners can still manually change any reservation status
3. **Email Integration**: All confirmation emails use existing templates and routing
4. **No Data Loss**: All reservations maintain full audit trails regardless of confirmation method
5. **Future Enhancement**: Settings UI currently shows environment variable values - future versions will save to database

---

## 🔮 **Future Enhancements**

- **Database-stored settings**: Save preferences to database instead of environment variables
- **Time-based rules**: Auto-confirm only during certain hours
- **Capacity-based rules**: Auto-confirm only when below certain capacity
- **Customer-based rules**: Different rules for VIP vs regular customers
- **Owner notification emails**: Implement actual email notifications for pending reservations

---

## 💡 **Tips for Success**

1. **Start Conservative**: Begin with manual confirmation, then gradually enable auto-confirmation
2. **Monitor Closely**: Watch confirmation rates and customer feedback when enabling auto-confirmation
3. **Staff Training**: Ensure staff understand the new workflow and when manual intervention is needed
4. **Regular Review**: Periodically review settings based on business needs and customer patterns
5. **Customer Communication**: Consider adding auto-confirmation status to booking confirmations

---

*This feature maintains TooHot's commitment to excellent customer service while providing operational flexibility for different business needs.* 