import { Client } from '@open-wa/wa-automate';
import type { ChatId } from '@open-wa/wa-automate';

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SHEET INTEGRATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

interface OutboundLead {
  chatId: string;
  sessionId: string;
  sheetId: string;
  category: 'clinic' | 'hotel';
  sentTime: number;
  messageId?: string;
}

// Track outbound leads to handle replies intelligently
const outboundLeads: Record<string, OutboundLead> = {};

// Clinic pricing negotiation state
const clinicNegotiation: Record<string, { minPrice: number; maxPrice: number; stage: string }> = {};

// Initialize clinic pricing for a chat
function initClinicPricing(chatId: string) {
  if (!clinicNegotiation[chatId]) {
    clinicNegotiation[chatId] = {
      minPrice: 4000,
      maxPrice: 7000,
      stage: 'initial'
    };
  }
}

// Register outbound lead for reply tracking
function registerOutboundLead(
  chatId: string,
  sessionId: string,
  sheetId: string,
  category: 'clinic' | 'hotel'
): void {
  outboundLeads[chatId] = {
    chatId,
    sessionId,
    sheetId,
    category,
    sentTime: Date.now()
  };

  if (category === 'clinic') {
    initClinicPricing(chatId);
  }

  console.log(`[OUTBOUND] Registered ${chatId} from ${sheetId} (${category})`);
}

// Check if chat is from outbound campaign
function isOutboundLead(chatId: string): boolean {
  return !!outboundLeads[chatId];
}

// Get outbound lead info
function getOutboundLead(chatId: string): OutboundLead | null {
  return outboundLeads[chatId] || null;
}

// Handle clinic pricing negotiation
function handleClinicPricingReply(chatId: string, message: string): string | null {
  const negotiation = clinicNegotiation[chatId];
  if (!negotiation) return null;

  const msg = message.toLowerCase();
  const priceMatch = message.match(/\d+/g);
  const mentionedPrice = priceMatch ? parseInt(priceMatch[0]) : null;

  // User asking about price
  if (msg.includes('price') || msg.includes('cost') || msg.includes('kitna')) {
    return `Our clinic automation system is ₹${negotiation.minPrice} – ₹${negotiation.maxPrice}.\n\nThis includes patient inquiry system, appointment booking, and 24/7 support.\n\nShall I set this up for you?`;
  }

  // User mentions a price
  if (mentionedPrice) {
    if (mentionedPrice < negotiation.minPrice) {
      return `I understand budget is important. Our minimum is ₹${negotiation.minPrice} for the complete system.\n\nThis includes everything needed to automate patient inquiries.\n\nCan we work with this?`;
    } else if (mentionedPrice > negotiation.maxPrice) {
      return `Great! We can definitely work within that budget.\n\nOur standard package is ₹${negotiation.maxPrice} with all features included.\n\nShall I proceed with the setup?`;
    } else {
      return `Perfect! ₹${mentionedPrice} works for us.\n\nI'm locking your setup now. Our team will contact you shortly to complete everything.`;
    }
  }

  // User showing interest
  if (msg.includes('interested') || msg.includes('yes') || msg.includes('haan') || msg.includes('ok')) {
    return `Excellent! I'm setting up your clinic automation system now.\n\nOur team will contact you within 2 hours to complete the setup.\n\nThank you!`;
  }

  // User rejecting
  if (msg.includes('no') || msg.includes('nahi') || msg.includes('not interested')) {
    return `No problem! Feel free to reach out anytime if you change your mind.\n\nWe're here to help your clinic grow.`;
  }

  return null;
}

// Handle hotel reply (use existing bot logic)
function handleHotelReply(chatId: string, message: string): string | null {
  const msg = message.toLowerCase();

  if (msg.includes('interested') || msg.includes('yes') || msg.includes('haan')) {
    return `Great! I'm setting up your hotel booking system now.\n\nOur team will contact you within 2 hours to complete everything.\n\nThank you!`;
  }

  if (msg.includes('no') || msg.includes('nahi') || msg.includes('not interested')) {
    return `No problem! Feel free to reach out anytime.\n\nWe're here to help your hotel grow.`;
  }

  if (msg.includes('price') || msg.includes('cost') || msg.includes('kitna')) {
    return `Our hotel booking system is ₹5,000 – ₹10,000 depending on features.\n\nThis includes direct booking system, WhatsApp integration, and setup.\n\nShall I proceed?`;
  }

  return null;
}

// Process reply from outbound lead
function processOutboundReply(chatId: string, message: string): string | null {
  const lead = getOutboundLead(chatId);
  if (!lead) return null;

  console.log(`[OUTBOUND] Reply from ${chatId} (${lead.category}): ${message.substring(0, 50)}`);

  if (lead.category === 'clinic') {
    return handleClinicPricingReply(chatId, message);
  } else if (lead.category === 'hotel') {
    return handleHotelReply(chatId, message);
  }

  return null;
}

// Wrapper for sendSafe that integrates with outbound tracking
async function sendSafeWithOutboundTracking(
  client: Client,
  chatId: string,
  user: any,
  text: string,
  sessionId: string,
  sheetId?: string,
  category?: 'clinic' | 'hotel'
): Promise<boolean> {
  try {
    // If this is an outbound message, register it
    if (sheetId && category) {
      registerOutboundLead(chatId, sessionId, sheetId, category);
    }

    // Use existing sendSafe logic (will be injected)
    // For now, just send the message
    await client.sendText(chatId as ChatId, text);
    console.log(`[OUTBOUND] Message sent to ${chatId}`);
    return true;
  } catch (err: any) {
    console.error(`[OUTBOUND] Failed to send to ${chatId}:`, err.message);
    return false;
  }
}

// Priority handler for outbound replies
// This should be called BEFORE the regular bot logic
function shouldPrioritizeOutboundReply(chatId: string): boolean {
  return isOutboundLead(chatId);
}

// Get clinic pricing info
function getClinicPricingInfo(chatId: string): { min: number; max: number } | null {
  const negotiation = clinicNegotiation[chatId];
  return negotiation ? { min: negotiation.minPrice, max: negotiation.maxPrice } : null;
}

// Clean up old outbound leads (older than 7 days)
function cleanupOldOutboundLeads(): void {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  for (const [chatId, lead] of Object.entries(outboundLeads)) {
    if (now - lead.sentTime > sevenDaysMs) {
      delete outboundLeads[chatId];
      delete clinicNegotiation[chatId];
      console.log(`[OUTBOUND] Cleaned up old lead: ${chatId}`);
    }
  }
}

// Run cleanup every 24 hours
setInterval(cleanupOldOutboundLeads, 24 * 60 * 60 * 1000);

export {
  OutboundLead,
  registerOutboundLead,
  isOutboundLead,
  getOutboundLead,
  handleClinicPricingReply,
  handleHotelReply,
  processOutboundReply,
  sendSafeWithOutboundTracking,
  shouldPrioritizeOutboundReply,
  getClinicPricingInfo,
  cleanupOldOutboundLeads
};
