// ============================================
// Demo Dashboard - Shared Utilities
// ============================================

// Food rotation anchor system:
// - Before Dec 15: Dec 3 = Day 4 (original)
// - Dec 15-16: Dec 15 = Menu A - first skip
// - Dec 17+: Dec 17 = Day 4 (Pork) - skip Turkey, go straight to Pork

/**
 * Get the food rotation day ID for a given date
 * @param {Date} date - The date to calculate for
 * @returns {number} Day ID (1-4)
 */
function getDayRotation(date = new Date()) {
    try {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);

        let anchor, anchorDayId;

        // Check for dynamic anchor (set via schedule editor)
        const dynamicAnchor = getScheduleAnchor();
        if (dynamicAnchor && dynamicAnchor.date && dynamicAnchor.dayId) {
            const [year, month, day] = dynamicAnchor.date.split('-');
            const anchorDate = new Date(year, month - 1, day);
            anchorDate.setHours(0, 0, 0, 0);

            // Only use dynamic anchor for dates on or after the anchor date
            if (d >= anchorDate) {
                anchor = anchorDate;
                anchorDayId = dynamicAnchor.dayId;
            }
        }

        // If no dynamic anchor applies, use hardcoded fallbacks
        if (!anchor) {
            // Dec 30, 2025 = Menu A - 4-day rotation
            const dec30 = new Date('2025-12-30T00:00:00');
            dec30.setHours(0, 0, 0, 0);

            anchor = dec30;
            anchorDayId = 1; // Menu A
        }

        const diffTime = d.getTime() - anchor.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // 4-day rotation (Menu A, Menu B, Menu C, Menu D)
        let dayIndex = (anchorDayId - 1 + diffDays) % 4;
        if (dayIndex < 0) dayIndex += 4;

        return dayIndex + 1;
    } catch (err) {
        console.error('Error in getDayRotation:', err);
        // Fallback to simple calculation
        return ((Math.floor(Date.now() / 86400000) % 4) + 1);
    }
}

// ============================================
// Schedule Overrides
// ============================================

const SCHEDULE_OVERRIDES_KEY = 'demo_schedule_overrides';

/**
 * Get all schedule overrides
 * @returns {Object} Map of dateKey -> dayId (0 = skip, 1-5 = food day)
 */
function getScheduleOverrides() {
    const saved = localStorage.getItem(SCHEDULE_OVERRIDES_KEY);
    return saved ? JSON.parse(saved) : {};
}

/**
 * Set a schedule override for a specific date
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {number} dayId - Day ID (0 = skip, 1-5 = food day)
 */
async function setScheduleOverride(dateKey, dayId) {
    console.log('📅 Setting schedule override:', dateKey, '→ Day', dayId);
    const overrides = getScheduleOverrides();
    overrides[dateKey] = dayId;
    localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify(overrides));

    // Sync to Supabase settings
    await syncScheduleDataToCloud();
}

/**
 * Clear a schedule override for a specific date
 * @param {string} dateKey - Date in YYYY-MM-DD format
 */
async function clearScheduleOverride(dateKey) {
    const overrides = getScheduleOverrides();
    delete overrides[dateKey];
    localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify(overrides));

    // Sync to Supabase settings
    await syncScheduleDataToCloud();
}

/**
 * Sync schedule overrides and anchors to cloud
 */
async function syncScheduleDataToCloud() {
    const { syncSettings, fetchSettings } = window.DEMO_SUPABASE || {};
    if (!syncSettings) {
        console.warn('⚠️ syncSettings not available');
        return;
    }

    try {
        const overrides = getScheduleOverrides();
        const anchor = getScheduleAnchor();
        console.log('📅 Syncing schedule data:', { overrides, anchor });

        const settings = await fetchSettings() || {};
        settings.scheduleOverrides = overrides;
        settings.scheduleAnchor = anchor;

        const result = await syncSettings(settings);
        console.log('📅 Synced schedule data to cloud:', result);
    } catch (err) {
        console.error('❌ Error syncing schedule data:', err);
    }
}

/**
 * Load schedule overrides and anchors from cloud
 * CLOUD IS AUTHORITATIVE - always use cloud data, replacing any local data
 */
async function loadScheduleDataFromCloud() {
    const { fetchSettings } = window.DEMO_SUPABASE || {};
    if (!fetchSettings) {
        console.warn('⚠️ fetchSettings not available');
        return;
    }

    try {
        const settings = await fetchSettings();
        console.log('📅 Fetched settings from cloud:', settings);

        // CLOUD IS AUTHORITATIVE - ALWAYS replace local data with cloud data
        // Even if cloud is empty/null, we clear local to prevent stale data

        if (settings?.scheduleOverrides !== undefined) {
            localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify(settings.scheduleOverrides || {}));
            console.log('📅 Loaded schedule overrides from cloud:', settings.scheduleOverrides);
        } else {
            // Cloud has no overrides - clear local stale data
            localStorage.removeItem(SCHEDULE_OVERRIDES_KEY);
            console.log('📅 Cleared local schedule overrides (cloud has none)');
        }

        if (settings?.scheduleAnchor !== undefined) {
            localStorage.setItem(SCHEDULE_ANCHOR_KEY, JSON.stringify(settings.scheduleAnchor));
            console.log('📅 Loaded schedule anchor from cloud:', settings.scheduleAnchor);
        } else {
            // Cloud has no anchor - clear local stale data so hardcoded fallback is used
            localStorage.removeItem(SCHEDULE_ANCHOR_KEY);
            console.log('📅 Cleared local schedule anchor (cloud has none)');
        }
    } catch (err) {
        console.error('Error loading schedule data:', err);
    }
}

const SCHEDULE_ANCHOR_KEY = 'demo_schedule_anchor';

/**
 * Set a new schedule anchor point (for resuming normal schedule from a different day)
 * @param {Date} date - The date to start the new anchor from
 * @param {number} dayId - The day ID (1-4) for that date
 */
async function setScheduleAnchor(date, dayId) {
    const anchorData = {
        date: formatDateKey(date),
        dayId: dayId
    };
    localStorage.setItem(SCHEDULE_ANCHOR_KEY, JSON.stringify(anchorData));

    // Sync to Supabase settings
    await syncScheduleDataToCloud();
}

/**
 * Get the current dynamic schedule anchor (if set)
 * @returns {Object|null} { date: string, dayId: number } or null
 */
function getScheduleAnchor() {
    const saved = localStorage.getItem(SCHEDULE_ANCHOR_KEY);
    return saved ? JSON.parse(saved) : null;
}

/**
 * Get the food day data for a given date (checks overrides first)
 * @param {Date} date - The date to get data for
 * @returns {Object} Food day data object
 */
function getFoodDayForDate(date = new Date()) {
    const dateKey = formatDateKey(date);
    const overrides = getScheduleOverrides();

    // Check for override
    if (overrides[dateKey] !== undefined) {
        const overrideId = overrides[dateKey];
        if (overrideId === 0) {
            // Skip day - return a placeholder
            return {
                id: 0,
                name: 'Skip Day',
                shortName: 'Skip',
                emoji: '⏭️',
                categories: { Protein: '-', Starch: '-', Fat: '-', Milk: '-', Fruit: '-', Vegetable: '-', 'Cooking Starch': '-', 'Natural Sugar': '-' },
                meals: {},
                allowedFoods: []
            };
        }
        return applyFoodCustomizations(window.DEMO_DATA.FOOD_DAYS.find(d => d.id === overrideId));
    }

    // No override - use normal rotation
    const dayId = getDayRotation(date);
    return applyFoodCustomizations(window.DEMO_DATA.FOOD_DAYS.find(d => d.id === dayId));
}

/**
 * Apply any saved customizations to a food day
 */
function applyFoodCustomizations(foodDay) {
    if (!foodDay) return foodDay;

    const saved = localStorage.getItem('food_day_customizations');
    if (saved) {
        const customizations = JSON.parse(saved);
        if (customizations[foodDay.id]) {
            return {
                ...foodDay,
                categories: customizations[foodDay.id]
            };
        }
    }
    return foodDay;
}

/**
 * Format date to YYYY-MM-DD string (LOCAL timezone, not UTC)
 * @param {Date} date 
 * @returns {string}
 */
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format time from 24h to 12h format
 * @param {string} time24 - Time in HH:MM format
 * @returns {string} Time in 12h format
 */
function formatTime12h(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Get current time in HH:MM format
 * @returns {string}
 */
function getCurrentTime() {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
}

/**
 * Check if a time has passed today
 * @param {string} time24 - Time in HH:MM format
 * @returns {boolean}
 */
function hasTimePassed(time24) {
    return getCurrentTime() > time24;
}

/**
 * Get formatted display date
 * @param {Date} date 
 * @returns {string}
 */
function formatDisplayDate(date) {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Get short formatted date
 * @param {Date} date 
 * @returns {string}
 */
function formatShortDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Check if date is today
 * @param {Date} date 
 * @returns {boolean}
 */
function isToday(date) {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
}

/**
 * Check if date is a weekday
 * @param {Date} date 
 * @returns {boolean}
 */
function isWeekday(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
}

/**
 * Generate unique ID
 * @returns {string}
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================
// Local Storage Helpers
// ============================================

const STORAGE_KEYS = {
    MEDICINES: 'demo_medicines',
    MEDICINE_STATUS: 'demo_medicine_status',
    BOWEL: 'demo_bowel',
    FOOD_OVERRIDES: 'demo_food_overrides',
    SETTINGS: 'demo_settings'
};

/**
 * Get data from localStorage
 * @param {string} key 
 * @returns {any}
 */
function getStorageData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Error reading from localStorage:', e);
        return null;
    }
}

/**
 * Set data to localStorage
 * @param {string} key 
 * @param {any} data 
 */
function setStorageData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Error writing to localStorage:', e);
    }
}

/**
 * Get medicines for a specific date
 * @param {Date} date 
 * @returns {Object}
 */
function getMedicinesForDate(date) {
    // Check for custom global default first
    const customDefault = getStorageData('demo_custom_medicines');
    if (customDefault) {
        return customDefault;
    }
    return window.DEMO_DATA.DEFAULT_MEDICINES;
}

/**
 * Save medicines as the new global default (applies to all days)
 * @param {Object} medicines 
 */
function saveMedicinesAsDefault(medicines) {
    setStorageData('demo_custom_medicines', medicines);

    // Sync to Supabase if available
    if (window.DEMO_SUPABASE?.syncMedicines) {
        window.DEMO_SUPABASE.syncMedicines(medicines);
    }
}

/**
 * Get medicine status (given/not given) for a date
 * @param {Date} date 
 * @returns {Object}
 */
function getMedicineStatusForDate(date) {
    const dateKey = formatDateKey(date);
    const allStatus = getStorageData(STORAGE_KEYS.MEDICINE_STATUS) || {};
    return allStatus[dateKey] || { am: {}, pm: {}, evening: {} };
}

/**
 * Set medicine as given/not given
 * @param {Date} date 
 * @param {string} timeSlot - 'am', 'pm', or 'evening'
 * @param {string} medicineId 
 * @param {boolean} given 
 */
function setMedicineGiven(date, timeSlot, medicineId, given) {
    const dateKey = formatDateKey(date);
    const allStatus = getStorageData(STORAGE_KEYS.MEDICINE_STATUS) || {};

    if (!allStatus[dateKey]) {
        allStatus[dateKey] = { am: {}, pm: {}, evening: {} };
    }

    allStatus[dateKey][timeSlot][medicineId] = given;
    setStorageData(STORAGE_KEYS.MEDICINE_STATUS, allStatus);

    // Sync to Supabase if available
    if (window.DEMO_SUPABASE?.syncMedicineStatus) {
        window.DEMO_SUPABASE.syncMedicineStatus(dateKey, allStatus[dateKey]);
    }
}

/**
 * Get bowel movements for a date
 * @param {Date} date 
 * @returns {Array}
 */
function getBowelMovementsForDate(date) {
    const dateKey = formatDateKey(date);
    const allBowel = getStorageData(STORAGE_KEYS.BOWEL) || {};
    return allBowel[dateKey] || [];
}

/**
 * Add bowel movement
 * @param {Date} date 
 * @param {Object} movement - {type, notes}
 */
function addBowelMovement(date, movement) {
    const dateKey = formatDateKey(date);
    const allBowel = getStorageData(STORAGE_KEYS.BOWEL) || {};

    if (!allBowel[dateKey]) {
        allBowel[dateKey] = [];
    }

    allBowel[dateKey].push({
        id: generateId(),
        time: new Date().toTimeString().slice(0, 5),
        timestamp: new Date().toISOString(),
        ...movement
    });

    setStorageData(STORAGE_KEYS.BOWEL, allBowel);

    // Sync to Supabase if available
    if (window.DEMO_SUPABASE?.syncBowelMovements) {
        window.DEMO_SUPABASE.syncBowelMovements(dateKey, allBowel[dateKey]);
    }
}

/**
 * Delete bowel movement
 * @param {Date} date 
 * @param {string} movementId 
 */
function deleteBowelMovement(date, movementId) {
    const dateKey = formatDateKey(date);
    const allBowel = getStorageData(STORAGE_KEYS.BOWEL) || {};

    if (allBowel[dateKey]) {
        allBowel[dateKey] = allBowel[dateKey].filter(m => m.id !== movementId);
        setStorageData(STORAGE_KEYS.BOWEL, allBowel);

        // Sync to Supabase if available
        if (window.DEMO_SUPABASE?.syncBowelMovements) {
            window.DEMO_SUPABASE.syncBowelMovements(dateKey, allBowel[dateKey]);
        }
    }
}

/**
 * Get settings
 * @returns {Object}
 */
function getSettings() {
    return getStorageData(STORAGE_KEYS.SETTINGS) || {
        nannyHours: { start: '13:00', end: '19:00' },
        busPickup: '08:30',
        busDropoff: '15:30',
        schoolDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    };
}

/**
 * Save settings
 * @param {Object} settings 
 */
function saveSettings(settings) {
    setStorageData(STORAGE_KEYS.SETTINGS, settings);

    // Sync to Supabase if available
    if (window.DEMO_SUPABASE?.syncSettings) {
        window.DEMO_SUPABASE.syncSettings(settings);
    }
}

// Export for ES modules or attach to window
if (typeof window !== 'undefined') {
    window.DEMO_UTILS = {
        getDayRotation,
        getFoodDayForDate,
        formatDateKey,
        formatTime12h,
        getCurrentTime,
        hasTimePassed,
        formatDisplayDate,
        formatShortDate,
        isToday,
        isWeekday,
        generateId,
        STORAGE_KEYS,
        getStorageData,
        setStorageData,
        getMedicinesForDate,
        getMedicineStatusForDate,
        setMedicineGiven,
        saveMedicinesAsDefault,
        getBowelMovementsForDate,
        addBowelMovement,
        deleteBowelMovement,
        getSettings,
        saveSettings,
        getSleepForDate,
        setSleepForDate,
        getNotesForDate,
        setNotesForDate,
        getScheduleOverrides,
        setScheduleOverride,
        clearScheduleOverride,
        setScheduleAnchor,
        getScheduleAnchor,
        syncScheduleDataToCloud,
        loadScheduleDataFromCloud,
        getBehaviorsForDate,
        setBehaviorsForDate
    };
}

// ============================================
// Sleep Quality
// ============================================

const SLEEP_KEY = 'demo_sleep';

/**
 * Get sleep quality for a date
 */
function getSleepForDate(date) {
    const dateKey = formatDateKey(date);
    const allSleep = getStorageData(SLEEP_KEY) || {};
    return allSleep[dateKey] || null;
}

/**
 * Set sleep quality for a date
 */
function setSleepForDate(date, quality) {
    const dateKey = formatDateKey(date);
    const allSleep = getStorageData(SLEEP_KEY) || {};
    allSleep[dateKey] = {
        quality: quality,
        timestamp: new Date().toISOString()
    };
    setStorageData(SLEEP_KEY, allSleep);

    // Sync to Supabase if available
    if (window.DEMO_SUPABASE?.syncSleep) {
        window.DEMO_SUPABASE.syncSleep(dateKey, allSleep[dateKey]);
    }
}

// ============================================
// Daily Notes
// ============================================

const NOTES_KEY = 'demo_notes';

// ============================================
// Behavior Tags
// ============================================

const BEHAVIORS_KEY = 'demo_behaviors';

/**
 * Get behavior tags for a date
 */
function getBehaviorsForDate(date) {
    const dateKey = formatDateKey(date);
    const allBehaviors = getStorageData(BEHAVIORS_KEY) || {};
    return allBehaviors[dateKey] || [];
}

/**
 * Set behavior tags for a date
 */
function setBehaviorsForDate(date, tags) {
    const dateKey = formatDateKey(date);
    const allBehaviors = getStorageData(BEHAVIORS_KEY) || {};
    allBehaviors[dateKey] = tags;
    setStorageData(BEHAVIORS_KEY, allBehaviors);

    // Sync to Supabase if available
    if (window.DEMO_SUPABASE?.syncBehaviors) {
        window.DEMO_SUPABASE.syncBehaviors(dateKey, tags);
    }
}

/**
 * Get notes for a date
 */
function getNotesForDate(date) {
    const dateKey = formatDateKey(date);
    const allNotes = getStorageData(NOTES_KEY) || {};
    return allNotes[dateKey] || '';
}

/**
 * Set notes for a date
 */
function setNotesForDate(date, notes) {
    const dateKey = formatDateKey(date);
    const allNotes = getStorageData(NOTES_KEY) || {};
    allNotes[dateKey] = notes;
    setStorageData(NOTES_KEY, allNotes);

    // Sync to Supabase if available
    if (window.DEMO_SUPABASE?.syncNotes) {
        window.DEMO_SUPABASE.syncNotes(dateKey, notes);
    }
}
