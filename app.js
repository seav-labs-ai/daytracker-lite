// ============================================
// Demo Dashboard - Prototype B: Clean Care
// Main Application Logic
// ============================================

const APP = {
    currentDate: new Date(),
    selectedBowelType: null,
    foodExpanded: false
};

// ============================================
// App Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// ============================================
// Force Refresh (for PWA cache issues)
// ============================================

function forceRefresh() {
    // Clear service worker cache and reload
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        }).then(() => {
            window.location.reload(true);
        });
    } else {
        window.location.reload(true);
    }
}

// ============================================
// Sync All Data to Cloud (Data Recovery)
// ============================================

async function syncDataToCloud() {
    const { pushAllLocalDataToCloud } = window.DEMO_SUPABASE || {};

    if (!pushAllLocalDataToCloud) {
        alert('❌ Sync not available. Please refresh the page.');
        return;
    }

    // Show syncing indicator
    const btn = document.querySelector('.sync-btn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Syncing...';
    btn.disabled = true;

    try {
        const result = await pushAllLocalDataToCloud();

        if (result.success) {
            const r = result.results;
            alert(`✅ Data Synced to Cloud!\n\n` +
                `🚽 Potty: ${r.bowel.pushed} entries\n` +
                `😴 Sleep: ${r.sleep.pushed} entries\n` +
                `📝 Notes: ${r.notes.pushed} entries\n` +
                `💊 Medicines: ${r.medicines.pushed} checks`);
        } else {
            alert('❌ Sync failed: ' + result.error);
        }
    } catch (err) {
        alert('❌ Error syncing: ' + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Clear local data (used to clean up test entries)
function clearLocalData() {
    if (!confirm('⚠️ This will clear LOCAL data on THIS DEVICE only.\n\nCloud data will NOT be deleted.\n\nContinue?')) {
        return;
    }

    localStorage.removeItem('demo_bowel');
    localStorage.removeItem('demo_sleep');
    localStorage.removeItem('demo_notes');
    localStorage.removeItem('demo_medicine_status');
    localStorage.removeItem('growth_data'); // ensure old key is also purged

    alert('✅ Local data cleared!\n\nRefresh the page to load fresh data from the cloud.');

    // Reload from cloud
    location.reload();
}

// ============================================
// Initialization
// ============================================

async function initApp() {
    // Initialize dark mode from saved preference
    initDarkMode();

    // Initialize Supabase for cloud sync
    let supabaseReady = false;
    if (window.DEMO_SUPABASE?.initSupabase) {
        supabaseReady = window.DEMO_SUPABASE.initSupabase();

        // Set up real-time subscriptions if Supabase is ready
        if (supabaseReady) {
            updateSyncStatus('connected');
            setupRealtimeSync();
            // Load data from cloud
            updateSyncStatus('syncing');
            await loadDataFromCloud();

            // Load schedule overrides and anchors from cloud
            const { loadScheduleDataFromCloud } = window.DEMO_UTILS;
            await loadScheduleDataFromCloud();

            // Load medicines from cloud
            await loadMedicinesFromCloud();

            // Load food customizations from cloud
            await loadFoodCustomizationsFromCloud();

            // Load milk recipes from cloud
            await loadMilkRecipesFromCloud();

            // Load growth data from cloud
            await loadGrowthDataFromCloud();

            // Load last viewed date from cloud
            await loadCurrentDateFromCloud();

            // Pre-load timeline data (14 days) for the summary view
            loadTimelineDataFromCloud();

            updateSyncStatus('connected');
        } else {
            updateSyncStatus('error');
            console.warn('⚠️ Supabase not initialized - running in offline mode');
        }
    } else {
        updateSyncStatus('error');
    }

    updateUI();
}

// Pre-load data for all 14 days shown in the timeline (non-blocking)
async function loadTimelineDataFromCloud() {
    const { formatDateKey, setStorageData, getStorageData, STORAGE_KEYS } = window.DEMO_UTILS;
    const { fetchBowelEntries, fetchSleep } = window.DEMO_SUPABASE || {};

    if (!fetchBowelEntries && !fetchSleep) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Load 7 days before through 6 days after (14 days total)
    for (let i = -7; i <= 6; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateKey = formatDateKey(date);

        try {
            // Fetch bowel entries
            if (fetchBowelEntries) {
                const cloudEntries = await fetchBowelEntries(dateKey);
                if (cloudEntries && cloudEntries.length > 0) {
                    const allBowel = getStorageData(STORAGE_KEYS.BOWEL) || {};
                    allBowel[dateKey] = cloudEntries.map(e => ({
                        id: e.id,
                        type: e.type,
                        time: e.time,
                        notes: e.notes
                    }));
                    setStorageData(STORAGE_KEYS.BOWEL, allBowel);
                }
            }

            // Fetch sleep
            if (fetchSleep) {
                const sleepData = await fetchSleep(dateKey);
                if (sleepData) {
                    const allSleep = getStorageData('demo_sleep') || {};
                    allSleep[dateKey] = sleepData;
                    setStorageData('demo_sleep', allSleep);
                }
            }
        } catch (err) {
            // Ignore individual date errors, just continue
        }
    }

    // Re-render the timeline after loading all data
    renderVisualTimeline();
    console.log('📊 Timeline data pre-loaded for 14 days');
}

async function loadCurrentDateFromCloud() {
    const { fetchSettings } = window.DEMO_SUPABASE || {};
    if (!fetchSettings) return;

    try {
        const settings = await fetchSettings();
        if (settings?.currentDate) {
            APP.currentDate = new Date(settings.currentDate);
            console.log('📅 Loaded current date from cloud:', APP.currentDate);
        }
    } catch (err) {
        console.error('Error loading current date:', err);
    }
}

async function saveCurrentDateToCloud() {
    const { syncSettings } = window.DEMO_SUPABASE || {};
    if (!syncSettings) return;

    try {
        const settings = await window.DEMO_SUPABASE.fetchSettings() || {};
        settings.currentDate = APP.currentDate.toISOString();
        await syncSettings(settings);
        console.log('📅 Saved current date to cloud:', APP.currentDate);
    } catch (err) {
        console.error('Error saving current date:', err);
    }
}

async function loadMedicinesFromCloud() {
    const { fetchMedicines } = window.DEMO_SUPABASE || {};
    if (!fetchMedicines) return;

    try {
        const cloudMedicines = await fetchMedicines('default');
        if (cloudMedicines) {
            // Found cloud medicines, parse and set them as default custom medicines
            localStorage.setItem('demo_custom_medicines', JSON.stringify(cloudMedicines));
            console.log('💊 Loaded medicines configuration from cloud');
        }
    } catch (err) {
        console.error('Error loading medicines from cloud:', err);
    }
}

async function loadFoodCustomizationsFromCloud() {
    const { fetchFoodCustomizations } = window.DEMO_SUPABASE || {};
    if (!fetchFoodCustomizations) return;

    try {
        const cloudCustomizations = await fetchFoodCustomizations();
        if (cloudCustomizations && Object.keys(cloudCustomizations).length > 0) {
            // Cloud has customizations - use them (cloud is authoritative)
            localStorage.setItem('food_day_customizations', JSON.stringify(cloudCustomizations));
            console.log('🍽️ Loaded food customizations from cloud:', cloudCustomizations);
        }
    } catch (err) {
        console.error('Error loading food customizations:', err);
    }
}

function updateSyncStatus(status) {
    const el = document.getElementById('syncStatus');
    if (!el) return;

    el.className = 'sync-status';

    switch (status) {
        case 'connected':
            el.textContent = '☁️';
            el.classList.add('connected');
            el.title = 'Connected to cloud';
            break;
        case 'syncing':
            el.textContent = '☁️';
            el.classList.add('syncing');
            el.title = 'Syncing...';
            break;
        case 'error':
            el.textContent = '⚠️';
            el.classList.add('error');
            el.title = 'Offline - data saved locally only';
            break;
    }
}

// ============================================
// Dark Mode
// ============================================

function initDarkMode() {
    // Dark mode is now the default
    const isDark = localStorage.getItem('darkMode') !== 'false';
    if (isDark) {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon(true);
    }
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    updateDarkModeIcon(isDark);
}

function updateDarkModeIcon(isDark) {
    const icon = document.getElementById('darkModeIcon');
    if (icon) {
        icon.textContent = isDark ? '☀️' : '🌙';
    }
}

// ============================================
// Loading Overlay
// ============================================

function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay?.querySelector('.loading-text');
    if (text) text.textContent = message;
    overlay?.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay')?.classList.add('hidden');
}

// ============================================
// Toast Notifications with Undo
// ============================================

let lastUndoAction = null;

function showToast(message, undoAction = null, duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    if (undoAction) {
        lastUndoAction = undoAction;
        const undoBtn = document.createElement('button');
        undoBtn.className = 'toast-undo';
        undoBtn.textContent = 'Undo';
        undoBtn.onclick = async () => {
            await undoAction();
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
            showToast('✓ Action undone');
        };
        toast.appendChild(undoBtn);
    }

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Load data from Supabase on app start
async function loadDataFromCloud() {
    const { formatDateKey, setStorageData, STORAGE_KEYS, getStorageData } = window.DEMO_UTILS;
    const { fetchMedicineStatus, fetchBowelMovements, fetchSleep } = window.DEMO_SUPABASE || {};

    const dateKey = formatDateKey(APP.currentDate);

    try {
        // Fetch medicine status
        if (fetchMedicineStatus) {
            const medicineStatus = await fetchMedicineStatus(dateKey);
            console.log('🔍 Fetched medicine status from cloud:', medicineStatus);
            if (medicineStatus) {
                const allStatus = getStorageData(STORAGE_KEYS.MEDICINE_STATUS) || {};
                allStatus[dateKey] = medicineStatus;
                setStorageData(STORAGE_KEYS.MEDICINE_STATUS, allStatus);
            }
        }

        // Fetch bowel entries from cloud (individual records)
        const { fetchBowelEntries } = window.DEMO_SUPABASE || {};
        if (fetchBowelEntries) {
            const cloudEntries = await fetchBowelEntries(dateKey);
            console.log('🔍 Fetched bowel entries from cloud for', dateKey, ':', cloudEntries);

            const allBowel = getStorageData(STORAGE_KEYS.BOWEL) || {};
            const localEntries = allBowel[dateKey] || [];

            if (cloudEntries && cloudEntries.length > 0) {
                // Cloud has data - use it
                allBowel[dateKey] = cloudEntries.map(e => ({
                    id: e.id,
                    type: e.type,
                    time: e.time,
                    notes: e.notes
                }));
                setStorageData(STORAGE_KEYS.BOWEL, allBowel);
                console.log('✅ Loaded', cloudEntries.length, 'bowel entries from cloud');
            } else if (localEntries.length > 0) {
                // Cloud is empty but local has data - keep local
                console.log('📱 Keeping', localEntries.length, 'local bowel entries (cloud is empty)');
            }
        }

        // Fetch sleep quality
        if (fetchSleep) {
            const sleepData = await fetchSleep(dateKey);
            console.log('🔍 Fetched sleep from cloud:', sleepData);
            if (sleepData) {
                const allSleep = getStorageData('demo_sleep') || {};
                allSleep[dateKey] = sleepData;
                setStorageData('demo_sleep', allSleep);
            }
        }

        // Fetch daily notes
        const { fetchNotes } = window.DEMO_SUPABASE || {};
        if (fetchNotes) {
            const notesData = await fetchNotes(dateKey);
            console.log('🔍 Fetched notes from cloud:', notesData);
            if (notesData) {
                const allNotes = getStorageData('demo_notes') || {};
                allNotes[dateKey] = notesData;
                setStorageData('demo_notes', allNotes);
            }
        }

        // Fetch behaviors
        const { fetchBehaviors } = window.DEMO_SUPABASE || {};
        if (fetchBehaviors) {
            const behaviorsData = await fetchBehaviors(dateKey);
            console.log('🔍 Fetched behaviors from cloud:', behaviorsData);
            if (behaviorsData) {
                const allBehaviors = getStorageData('demo_behaviors') || {};
                allBehaviors[dateKey] = behaviorsData;
                setStorageData('demo_behaviors', allBehaviors);
            }
        }
    } catch (err) {
        console.error('Error loading data from cloud:', err);
    }

    // Always update UI, regardless of cloud sync success
    updateUI();
}

// Real-time sync - auto-refresh UI when data changes on other devices
function setupRealtimeSync() {
    const { subscribeToChanges } = window.DEMO_SUPABASE;

    // Subscribe to medicine status changes
    subscribeToChanges('medicine_status', (payload) => {
        console.log('💊 Medicine status updated remotely');
        renderMedicines();
    });

    // Subscribe to medicine configuration changes
    subscribeToChanges('medicines', async (payload) => {
        console.log('💊 Medicine configuration updated remotely');
        await loadMedicinesFromCloud();
        renderMedicines();
    });

    // Subscribe to bowel movement changes
    subscribeToChanges('bowel_movements', (payload) => {
        console.log('📝 Bowel log updated remotely');
        renderBowelLog();
    });

    // Subscribe to sleep quality changes
    subscribeToChanges('sleep_quality', (payload) => {
        console.log('😴 Sleep updated remotely');
        renderSleep();
    });

    // Subscribe to behaviors
    subscribeToChanges('daily_behaviors', (payload) => {
        console.log('⭐ Behaviors updated remotely');
        renderBehaviors();
    });

    // Subscribe to settings changes (for current date and schedule sync)
    subscribeToChanges('settings', async (payload) => {
        console.log('⚙️ Settings updated remotely');
        const { loadScheduleDataFromCloud } = window.DEMO_UTILS;
        await loadScheduleDataFromCloud();
        await loadCurrentDateFromCloud();
        updateUI();
    });

    console.log('🔄 Real-time sync enabled');
}

function updateUI() {
    renderDateDisplay();
    renderWeekGlance();
    renderFoodBanner();
    renderMedicines();
    renderBehaviors();
    renderBowelLog();
    renderSleep();
    renderDailyNotes();
    renderGrowth();
    renderVisualTimeline();
    renderPatternAlerts();
    loadCachedInsights();

    if (window.I18N && typeof window.I18N.updateDOM === 'function') {
        window.I18N.updateDOM();
    }
}

// ============================================
// Haptic Feedback
// ============================================

function haptic(style = 'light') {
    if ('vibrate' in navigator) {
        // Android
        const patterns = {
            light: [10],
            medium: [20],
            heavy: [30],
            success: [10, 50, 10],
            error: [50, 30, 50]
        };
        navigator.vibrate(patterns[style] || patterns.light);
    }
    // iOS doesn't support navigator.vibrate, but PWA clicks feel responsive anyway
}

// ============================================
// Daily Notes
// ============================================

let notesSaveTimeout = null;

function renderDailyNotes() {
    const { getNotesForDate } = window.DEMO_UTILS;
    const notes = getNotesForDate(APP.currentDate);
    document.getElementById('dailyNotes').value = notes || '';
    document.getElementById('notesSaveStatus').textContent = '';
}

// Save notes - CLOUD FIRST
function saveDailyNotes() {
    // Show saving status
    const statusEl = document.getElementById('notesSaveStatus');
    statusEl.textContent = 'Saving...';
    statusEl.className = 'save-status saving';

    // Debounce - wait 500ms after typing stops
    clearTimeout(notesSaveTimeout);
    notesSaveTimeout = setTimeout(async () => {
        const { setNotesForDate, formatDateKey } = window.DEMO_UTILS;
        const { syncNotes } = window.DEMO_SUPABASE || {};

        const notes = document.getElementById('dailyNotes').value;

        // Save local
        setNotesForDate(APP.currentDate, notes);

        // Sync to cloud
        if (syncNotes) {
            updateSyncStatus('syncing');
            await syncNotes(formatDateKey(APP.currentDate), notes);
            updateSyncStatus('connected');
        }

        statusEl.textContent = 'Saved ✓';
        statusEl.className = 'save-status saved';

        // Clear status after 2 seconds
        setTimeout(() => {
            statusEl.textContent = '';
        }, 2000);
    }, 500);
}

// ============================================
// Sleep Quality
// ============================================

function renderSleep() {
    const { getSleepForDate } = window.DEMO_UTILS;
    const sleepData = getSleepForDate(APP.currentDate);

    // Update button states
    const buttons = document.querySelectorAll('.sleep-btn');
    buttons.forEach(btn => {
        btn.classList.remove('selected');
        if (sleepData && btn.dataset.quality === sleepData.quality) {
            btn.classList.add('selected');
        }
    });
}

// Set sleep - CLOUD FIRST
async function setSleep(quality) {
    const { setSleepForDate, getSleepForDate, formatDateKey } = window.DEMO_UTILS;
    const { syncSleep } = window.DEMO_SUPABASE || {};

    const previousQuality = getSleepForDate(APP.currentDate)?.quality;

    // Update local immediately
    setSleepForDate(APP.currentDate, quality);
    renderSleep();
    renderVisualTimeline();

    // Sync to cloud
    if (syncSleep) {
        updateSyncStatus('syncing');
        await syncSleep(formatDateKey(APP.currentDate), { quality, timestamp: Date.now() });
        updateSyncStatus('connected');
    }

    const emoji = quality === 'good' ? '😴' : '😫';
    showToast(`${emoji} Sleep logged as ${quality}`, async () => {
        // Undo: restore previous quality or clear
        if (previousQuality) {
            setSleepForDate(APP.currentDate, previousQuality);
            if (syncSleep) await syncSleep(formatDateKey(APP.currentDate), { quality: previousQuality, timestamp: Date.now() });
        } else {
            setSleepForDate(APP.currentDate, null);
        }
        renderSleep();
        renderVisualTimeline();
    });
}

// ============================================
// Date Display & Navigation
// ============================================

function renderDateDisplay() {
    const { formatDisplayDate, isToday, formatShortDate } = window.DEMO_UTILS;

    const isTodayDate = isToday(APP.currentDate);
    const display = isTodayDate
        ? 'Today, ' + formatShortDate(APP.currentDate)
        : formatDisplayDate(APP.currentDate);

    document.getElementById('displayDate').textContent = display;

    // Show/hide Today button
    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
        todayBtn.classList.toggle('hidden', isTodayDate);
    }
}

// Render the week at a glance bar
function renderWeekGlance() {
    const container = document.getElementById('weekGlance');
    if (!container) return;

    const { getDayRotation, formatDateKey, isToday } = window.DEMO_UTILS;
    const { FOOD_DAYS } = window.DEMO_DATA;

    // Get current week (Sun-Sat containing the selected date)
    const currentDateKey = formatDateKey(APP.currentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from 3 days before and go to 3 days after
    const days = [];
    for (let i = -3; i <= 3; i++) {
        const d = new Date(APP.currentDate);
        d.setDate(d.getDate() + i);
        d.setHours(0, 0, 0, 0);

        const dayId = getDayRotation(d);
        const food = FOOD_DAYS.find(f => f.id === dayId);
        const dateKey = formatDateKey(d);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

        days.push({
            date: d,
            dateKey,
            dayName,
            emoji: food?.emoji || '❓',
            isSelected: dateKey === currentDateKey,
            isToday: isToday(d)
        });
    }

    container.innerHTML = days.map(day => `
        <div class="week-day ${day.isSelected ? 'selected' : ''} ${day.isToday ? 'today-marker' : ''}" 
             onclick="goToDate('${day.dateKey}')">
            <span class="week-day-name">${day.dayName}</span>
            <span class="week-day-emoji">${day.emoji}</span>
        </div>
    `).join('');
}

// Navigate to a specific date from week glance
async function goToDate(dateKey) {
    const [year, month, day] = dateKey.split('-');
    APP.currentDate = new Date(year, month - 1, day, 12, 0, 0);
    await saveCurrentDateToCloud();
    await loadDataFromCloud();
    updateUI();
}

async function changeDate(days) {
    APP.currentDate.setDate(APP.currentDate.getDate() + days);
    // Save to cloud so all devices see the same date
    await saveCurrentDateToCloud();
    // Load data from cloud for the new date
    await loadDataFromCloud();
    // Update the UI to reflect the new date
    updateUI();
}

function openDatePicker() {
    const input = document.getElementById('datePickerInput');
    // Format current date as YYYY-MM-DD for input
    const year = APP.currentDate.getFullYear();
    const month = String(APP.currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(APP.currentDate.getDate()).padStart(2, '0');
    input.value = `${year}-${month}-${day}`;

    document.getElementById('datePickerModal').classList.remove('hidden');
}

function closeDatePicker() {
    document.getElementById('datePickerModal').classList.add('hidden');
}

async function confirmDatePicker() {
    const input = document.getElementById('datePickerInput');
    if (input.value) {
        APP.currentDate = new Date(input.value + 'T12:00:00'); // Noon to avoid timezone issues
        await saveCurrentDateToCloud();
        await loadDataFromCloud();
    }
    closeDatePicker();
}

async function goToToday() {
    APP.currentDate = new Date();
    await saveCurrentDateToCloud();
    await loadDataFromCloud();
    closeDatePicker();
}

// Jump to today from anywhere (header button)
async function jumpToToday() {
    APP.currentDate = new Date();
    await saveCurrentDateToCloud();
    await loadDataFromCloud();
    updateUI();
}

async function goToYesterday() {
    APP.currentDate = new Date();
    APP.currentDate.setDate(APP.currentDate.getDate() - 1);
    await saveCurrentDateToCloud();
    await loadDataFromCloud();
    closeDatePicker();
}

async function goToTomorrow() {
    APP.currentDate = new Date();
    APP.currentDate.setDate(APP.currentDate.getDate() + 1);
    await saveCurrentDateToCloud();
    await loadDataFromCloud();
    closeDatePicker();
}

// ============================================
// Food Banner
// ============================================

function renderFoodBanner() {
    const { getFoodDayForDate } = window.DEMO_UTILS;
    const food = getFoodDayForDate(APP.currentDate);

    if (!food) {
        console.error('No food data found for date:', APP.currentDate);
        return;
    }

    const banner = document.getElementById('foodBanner');
    // Extract just the food type (e.g., "Chicken" from "Day 1 Chicken")
    const foodType = food.shortName.split(' ').pop().toLowerCase();
    banner.className = `food-banner ${foodType}`;

    document.getElementById('foodEmoji').textContent = food.emoji || '🍽️';
    document.getElementById('foodDayName').textContent = food.name || 'Unknown Day';

    // Show all categories in compact format
    const allCategories = [
        food.categories.Protein,
        food.categories.Starch,
        food.categories.Fat,
        food.categories.Milk,
        food.categories.Fruit,
        food.categories.Vegetable,
        food.categories['Cooking Starch'],
        food.categories['Natural Sugar']
    ].filter(Boolean);
    document.getElementById('foodCategories').textContent = allCategories.join(' • ');

    // Show tomorrow's milk for prep reminder
    const tomorrow = new Date(APP.currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFood = getFoodDayForDate(tomorrow);
    const milkName = tomorrowFood?.categories?.Milk || 'Unknown';
    document.getElementById('prepMilkName').textContent = milkName;
    // Store for recipe lookup
    APP.currentMilkName = milkName;

    renderFoodDetails(food);
}

function renderFoodDetails(food) {
    const grid = document.getElementById('mealsGrid');

    grid.innerHTML = Object.entries(food.meals).map(([time, meal]) => `
        <div class="meal-row">
            <span class="meal-time-label">${time}</span>
            <span class="meal-description">${meal}</span>
        </div>
    `).join('');
}

function toggleFoodDetail() {
    APP.foodExpanded = !APP.foodExpanded;

    const details = document.getElementById('foodDetails');
    const btn = document.querySelector('.expand-btn');

    details.classList.toggle('hidden', !APP.foodExpanded);
    btn.classList.toggle('expanded', APP.foodExpanded);
}

// ============================================
// Medicines
// ============================================

function renderMedicines() {
    const { getMedicinesForDate, getMedicineStatusForDate } = window.DEMO_UTILS;

    const meds = getMedicinesForDate(APP.currentDate);
    const status = getMedicineStatusForDate(APP.currentDate);

    const slots = ['am', 'evening'];

    slots.forEach(slot => {
        const container = document.getElementById(`${slot}Meds`);
        if (!container) return;

        const slotMeds = meds[slot] || [];
        const slotStatus = status[slot] || {};

        container.innerHTML = slotMeds.map(med => {
            const isGiven = slotStatus[med.id] || false;
            const doseHtml = med.dose ? `<div class="med-dose">${med.dose}</div>` : '';
            return `
                <div class="med-pill ${isGiven ? 'given' : ''}" onclick="toggleMed('${slot}', '${med.id}', '${med.name.replace(/'/g, "\\'")}')">
                    <span class="check-icon"></span>
                    <div class="med-content">
                        <span class="med-name">${med.name}</span>
                        ${doseHtml}
                    </div>
                </div>
            `;
        }).join('') || '<span class="empty-message">None</span>';
    });
}

// Toggle medicine - CLOUD FIRST
async function toggleMed(slot, medId, medName) {
    haptic('light');

    const { getMedicineStatusForDate, setMedicineGiven, formatDateKey } = window.DEMO_UTILS;
    const { setMedicineCheck } = window.DEMO_SUPABASE || {};

    const status = getMedicineStatusForDate(APP.currentDate);
    const current = status[slot]?.[medId] || false;
    const newValue = !current;

    // Update local immediately for responsiveness
    setMedicineGiven(APP.currentDate, slot, medId, newValue);
    renderMedicines();

    // Sync to cloud
    if (setMedicineCheck) {
        updateSyncStatus('syncing');
        const result = await setMedicineCheck(formatDateKey(APP.currentDate), slot, medId, newValue);
        updateSyncStatus(result ? 'connected' : 'error');

        // Visual save confirmation
        if (result) {
            showSaveFlash(slot, medId);
        }
    }
}

// Show brief save confirmation flash on element
function showSaveFlash(slot, medId) {
    // Find the med pill that was just toggled
    const container = document.getElementById(`${slot}Meds`);
    if (!container) return;

    const pills = container.querySelectorAll('.med-pill');
    pills.forEach(pill => {
        if (pill.textContent.includes(medId)) {
            pill.classList.add('save-flash');
            setTimeout(() => pill.classList.remove('save-flash'), 300);
        }
    });
}

function openMedicineEditor() {
    closeQuickMenu();

    const { formatDisplayDate, getMedicinesForDate } = window.DEMO_UTILS;

    document.getElementById('medEditDate').textContent = formatDisplayDate(APP.currentDate);

    const meds = getMedicinesForDate(APP.currentDate);
    const form = document.getElementById('medicineForm');

    const slots = [
        { key: 'am', label: 'Morning (AM)' },
        { key: 'evening', label: 'Evening' }
    ];

    form.innerHTML = slots.map(slot => {
        const slotMeds = meds[slot.key] || [];

        return `
            <div class="form-group">
                <label>${slot.label}</label>
                <div id="medForm_${slot.key}">
                    ${slotMeds.map((med, i) => `
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <input type="text" value="${med.name}" placeholder="Name" 
                                   data-slot="${slot.key}" data-idx="${i}" data-field="name" style="flex:1">
                            <input type="text" value="${med.dose}" placeholder="Dose" 
                                   data-slot="${slot.key}" data-idx="${i}" data-field="dose" style="width:80px">
                        </div>
                    `).join('')}
                    <button type="button" onclick="addMedField('${slot.key}')" 
                            style="width:100%; padding:8px; border:1px dashed #ccc; background:transparent; border-radius:6px; cursor:pointer;">
                        + Add
                    </button>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('medicineModal').classList.remove('hidden');
}

function addMedField(slot) {
    const container = document.getElementById(`medForm_${slot}`);
    const idx = container.querySelectorAll('input[data-field="name"]').length;

    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:8px; margin-bottom:8px;';
    div.innerHTML = `
        <input type="text" value="" placeholder="Name" 
               data-slot="${slot}" data-idx="${idx}" data-field="name" style="flex:1">
        <input type="text" value="" placeholder="Dose" 
               data-slot="${slot}" data-idx="${idx}" data-field="dose" style="width:80px">
    `;
    container.insertBefore(div, container.lastElementChild);
}

function closeMedicineEditor() {
    document.getElementById('medicineModal').classList.add('hidden');
}

function saveMedicines() {
    const { saveMedicinesAsDefault } = window.DEMO_UTILS;

    const slots = ['am', 'evening'];
    const newMeds = {};

    slots.forEach(slot => {
        const names = document.querySelectorAll(`input[data-slot="${slot}"][data-field="name"]`);
        const doses = document.querySelectorAll(`input[data-slot="${slot}"][data-field="dose"]`);

        newMeds[slot] = [];
        names.forEach((input, i) => {
            if (input.value.trim()) {
                newMeds[slot].push({
                    id: `${slot}_${i}_${Date.now()}`,
                    name: input.value.trim(),
                    dose: doses[i]?.value.trim() || '',
                    icon: '💊'
                });
            }
        });
    });

    // Save as global default (applies to all days)
    saveMedicinesAsDefault(newMeds);

    closeMedicineEditor();
    renderMedicines();
}

// ============================================
// Milk Recipes
// ============================================

function getMilkRecipes() {
    const saved = localStorage.getItem('milk_recipes');
    return saved ? JSON.parse(saved) : {};
}

function saveMilkRecipes(recipes) {
    localStorage.setItem('milk_recipes', JSON.stringify(recipes));
}

function openMilkRecipe() {
    const milkName = APP.currentMilkName;
    if (!milkName || milkName === 'Unknown') return;

    document.getElementById('milkRecipeName').textContent = milkName;

    // Load existing recipe
    const recipes = getMilkRecipes();
    const recipe = recipes[milkName] || '';
    document.getElementById('milkRecipeText').value = recipe;

    document.getElementById('milkRecipeModal').classList.remove('hidden');
}

function closeMilkRecipe() {
    document.getElementById('milkRecipeModal').classList.add('hidden');
}

async function saveMilkRecipe() {
    const milkName = APP.currentMilkName;
    const recipeText = document.getElementById('milkRecipeText').value.trim();

    // Save to localStorage
    const recipes = getMilkRecipes();
    recipes[milkName] = recipeText;
    saveMilkRecipes(recipes);

    // Sync to cloud (using settings)
    const { syncSettings, fetchSettings } = window.DEMO_SUPABASE || {};
    if (syncSettings && fetchSettings) {
        try {
            const settings = await fetchSettings() || {};
            settings.milkRecipes = recipes;
            await syncSettings(settings);
            console.log('🥛 Milk recipes synced to cloud');
        } catch (err) {
            console.error('Error syncing milk recipes:', err);
        }
    }

    closeMilkRecipe();
    showToast(`✅ ${milkName} recipe saved!`);
}

// Load milk recipes from cloud on startup
async function loadMilkRecipesFromCloud() {
    const { fetchSettings } = window.DEMO_SUPABASE || {};
    if (!fetchSettings) return;

    try {
        const settings = await fetchSettings();
        if (settings?.milkRecipes) {
            saveMilkRecipes(settings.milkRecipes);
            console.log('🥛 Loaded milk recipes from cloud');
        }
    } catch (err) {
        console.error('Error loading milk recipes:', err);
    }
}

// ============================================
// Growth Tracking
// ============================================

function getGrowthData() {
    let saved = localStorage.getItem('demo_growth_data');
    if (!saved) {
        // Provide a default demo value of 22.0 lbs
        const defaultData = [{
            date: new Date().toISOString().split('T')[0],
            weight: 22.0,
            height: 31.5
        }];
        localStorage.setItem('demo_growth_data', JSON.stringify(defaultData));
        saved = JSON.stringify(defaultData);
    }
    return saved ? JSON.parse(saved) : [];
}

function saveGrowthData(data) {
    localStorage.setItem('demo_growth_data', JSON.stringify(data));
}

function openGrowthModal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('growthDate').value = `${year}-${month}-${day}`;
    document.getElementById('growthWeight').value = '';
    document.getElementById('growthHeight').value = '';
    document.getElementById('growthModal').classList.remove('hidden');
}

function closeGrowthModal() {
    document.getElementById('growthModal').classList.add('hidden');
}

async function saveGrowth() {
    const weight = parseFloat(document.getElementById('growthWeight').value);
    const height = parseFloat(document.getElementById('growthHeight').value);
    const date = document.getElementById('growthDate').value;

    if (!weight && !height) {
        showToast('Please enter weight or height');
        return;
    }

    const entry = {
        date,
        weight: weight || null,
        height: height || null,
        timestamp: new Date().toISOString()
    };

    // Save to localStorage
    const data = getGrowthData();
    data.push(entry);
    // Sort by date (newest first)
    data.sort((a, b) => new Date(b.date) - new Date(a.date));
    saveGrowthData(data);

    // Sync to cloud
    const { syncSettings, fetchSettings } = window.DEMO_SUPABASE || {};
    if (syncSettings && fetchSettings) {
        try {
            const settings = await fetchSettings() || {};
            settings.growthData = data;
            await syncSettings(settings);
            console.log('📏 Growth data synced to cloud');
        } catch (err) {
            console.error('Error syncing growth data:', err);
        }
    }

    closeGrowthModal();
    renderGrowth();
    showToast('📏 Growth logged!');
}

function renderGrowth() {
    const container = document.getElementById('latestGrowth');
    if (!container) return;

    const data = getGrowthData();

    if (data.length === 0) {
        container.innerHTML = '<span class="growth-empty">Tap "Log" to track weight & height</span>';
        return;
    }

    // Get latest entry
    const latest = data[0];
    const dateStr = new Date(latest.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    container.innerHTML = `
        <div class="growth-stats">
            ${latest.weight ? `
                <div class="growth-stat">
                    <span class="growth-value">${latest.weight} lbs</span>
                    <span class="growth-label">Weight</span>
                </div>
            ` : ''}
            ${latest.height ? `
                <div class="growth-stat">
                    <span class="growth-value">${latest.height}"</span>
                    <span class="growth-label">Height</span>
                </div>
            ` : ''}
        </div>
        <span class="growth-date">as of ${dateStr}</span>
    `;
}

// Load growth data from cloud on startup
async function loadGrowthDataFromCloud() {
    const { fetchSettings } = window.DEMO_SUPABASE || {};
    if (!fetchSettings) return;

    try {
        const settings = await fetchSettings();
        if (settings?.growthData) {
            saveGrowthData(settings.growthData);
            console.log('📏 Loaded growth data from cloud');
        }
    } catch (err) {
        console.error('Error loading growth data:', err);
    }
}

// ============================================
// Food Day Editor
// ============================================

let currentEditingFoodDayId = null;

function openFoodEditor() {
    const { getFoodDayForDate } = window.DEMO_UTILS;
    const food = getFoodDayForDate(APP.currentDate);

    if (!food || food.id === 0) {
        showToast('Cannot edit a skipped day');
        return;
    }

    currentEditingFoodDayId = food.id;

    document.getElementById('foodEditDayName').textContent = food.name;

    // Get saved customizations or use defaults
    const customizations = getFoodDayCustomizations(food.id);
    const categories = customizations || food.categories;

    const form = document.getElementById('foodEditorForm');
    const categoryKeys = ['Protein', 'Fat', 'Starch', 'Milk', 'Fruit', 'Vegetable', 'Cooking Starch', 'Natural Sugar'];

    form.innerHTML = categoryKeys.map(key => `
        <div class="food-editor-row">
            <label>${key}</label>
            <input type="text" id="foodEdit_${key.replace(/\s/g, '_')}" value="${categories[key] || ''}">
        </div>
    `).join('');

    document.getElementById('foodEditorModal').classList.remove('hidden');
}

function closeFoodEditor() {
    document.getElementById('foodEditorModal').classList.add('hidden');
    currentEditingFoodDayId = null;
}

function saveFoodDay() {
    if (!currentEditingFoodDayId) return;

    const categoryKeys = ['Protein', 'Fat', 'Starch', 'Milk', 'Fruit', 'Vegetable', 'Cooking Starch', 'Natural Sugar'];
    const newCategories = {};

    categoryKeys.forEach(key => {
        const input = document.getElementById(`foodEdit_${key.replace(/\s/g, '_')}`);
        if (input) {
            newCategories[key] = input.value.trim();
        }
    });

    // Save to localStorage
    saveFoodDayCustomizations(currentEditingFoodDayId, newCategories);

    // Sync to Supabase
    if (window.DEMO_SUPABASE?.syncFoodCustomizations) {
        window.DEMO_SUPABASE.syncFoodCustomizations(currentEditingFoodDayId, newCategories);
    }

    closeFoodEditor();
    updateUI();
    showToast('✅ Food day updated permanently');
}

function getFoodDayCustomizations(dayId) {
    const saved = localStorage.getItem('food_day_customizations');
    if (saved) {
        const all = JSON.parse(saved);
        return all[dayId] || null;
    }
    return null;
}

function saveFoodDayCustomizations(dayId, categories) {
    const saved = localStorage.getItem('food_day_customizations');
    const all = saved ? JSON.parse(saved) : {};
    all[dayId] = categories;
    localStorage.setItem('food_day_customizations', JSON.stringify(all));
}

// ============================================
// Schedule
// ============================================

function renderSchedule() {
    const { isWeekday, formatTime12h, getCurrentTime, isToday } = window.DEMO_UTILS;
    const { SCHEDULE_TEMPLATES } = window.DEMO_DATA;

    const schedule = isWeekday(APP.currentDate)
        ? SCHEDULE_TEMPLATES.weekday
        : SCHEDULE_TEMPLATES.weekend;

    const now = getCurrentTime();
    const list = document.getElementById('scheduleList');
    if (!list) return;

    let currentIdx = -1;
    if (isToday(APP.currentDate)) {
        for (let i = 0; i < schedule.length; i++) {
            if (schedule[i].time <= now) currentIdx = i;
        }
    }

    list.innerHTML = schedule.map((event, i) => {
        let cls = 'schedule-row';
        if (isToday(APP.currentDate)) {
            if (i === currentIdx) cls += ' current';
            else if (i < currentIdx) cls += ' past';
        }

        return `
            <div class="${cls}">
                <span class="time">${formatTime12h(event.time)}</span>
                <span class="icon">${event.icon}</span>
                <span class="label">${event.label}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// Behaviors tracking
// ============================================

function renderBehaviors() {
    const { getBehaviorsForDate } = window.DEMO_UTILS;
    const { BEHAVIOR_CATEGORIES } = window.DEMO_DATA;

    const activeTags = getBehaviorsForDate(APP.currentDate);
    const container = document.getElementById('behaviorContainer');
    if (!container) return;

    container.innerHTML = BEHAVIOR_CATEGORIES.map(category => {
        return `
            <div class="behavior-category">
                <div class="behavior-category-name">${category.name}</div>
                <div class="behavior-chips-scroll">
                    ${category.tags.map(tag => {
            const isActive = activeTags.includes(tag.id);
            const isIdeal = tag.ideal;

            let classes = 'behavior-chip';
            if (isActive) classes += ' active';
            if (isIdeal) classes += ' ideal';

            return `
                            <button class="${classes}" onclick="toggleBehavior('${tag.id}')">
                                ${tag.label} ${isIdeal ? '⭐' : ''}
                            </button>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function toggleBehavior(tagId) {
    const { getBehaviorsForDate, setBehaviorsForDate } = window.DEMO_UTILS;
    const activeTags = getBehaviorsForDate(APP.currentDate);

    let newTags;
    if (activeTags.includes(tagId)) {
        newTags = activeTags.filter(id => id !== tagId); // Deselect
    } else {
        newTags = [...activeTags, tagId]; // Select
    }

    setBehaviorsForDate(APP.currentDate, newTags);
    renderBehaviors();

    // Add haptic feedback
    if (typeof haptic !== 'undefined') {
        haptic();
    }
}

// ============================================
// Bowel Tracking
// ============================================

function renderBowelLog() {
    const { getBowelMovementsForDate, formatTime12h } = window.DEMO_UTILS;
    const { BOWEL_TYPES } = window.DEMO_DATA;

    const movements = getBowelMovementsForDate(APP.currentDate);
    const log = document.getElementById('bowelLog');

    if (movements.length === 0) {
        log.innerHTML = '<div class="empty-message">No entries today</div>';
        return;
    }

    log.innerHTML = `
        <div class="bowel-entries">
            ${movements.map(m => {
        const type = BOWEL_TYPES.find(t => t.id === m.type) || BOWEL_TYPES[0];
        const chipClass = m.type === 'wet' || m.type === 'bad' ? 'type-bad' : m.type === 'soft' ? 'type-soft' : '';
        return `
                    <div class="bowel-chip ${chipClass}" title="${m.notes || ''}">
                        <span>${type.emoji}</span>
                        <span>${formatTime12h(m.time)}</span>
                        ${m.notes ? '📝' : ''}
                        <button class="del" onclick="deleteBowel('${m.id}')">×</button>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

// Quick log potty from inline buttons - CLOUD FIRST
async function quickLogPotty(type) {
    haptic('medium');

    const { formatDateKey } = window.DEMO_UTILS;
    const { addBowelEntry, deleteBowelEntry } = window.DEMO_SUPABASE || {};

    const dateKey = formatDateKey(APP.currentDate);
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // Show immediate feedback
    const typeEmoji = type === 'normal' ? '✅' : type === 'soft' ? '🟡' : '🔴';
    const typeLabel = type === 'normal' ? 'Good' : type === 'soft' ? 'Soft' : 'Wet';

    // Save to cloud FIRST
    let cloudEntry = null;
    if (addBowelEntry) {
        updateSyncStatus('syncing');
        cloudEntry = await addBowelEntry(dateKey, { type, time });
        updateSyncStatus(cloudEntry ? 'connected' : 'error');

        // Visual save confirmation - flash the button
        if (cloudEntry) {
            const btnSelector = type === 'normal' ? '.potty-btn:not(.soft):not(.wet)' : `.potty-btn.${type}`;
            const btn = document.querySelector(btnSelector);
            if (btn) {
                btn.classList.add('save-flash');
                setTimeout(() => btn.classList.remove('save-flash'), 300);
            }
        }
    }

    // Also save to localStorage as backup
    const { addBowelMovement, deleteBowelMovement } = window.DEMO_UTILS;
    const localEntry = addBowelMovement(APP.currentDate, {
        type,
        id: cloudEntry?.id || Date.now().toString()
    });

    renderBowelLog();
    renderVisualTimeline();

    // Show toast with undo
    showToast(`${typeEmoji} ${typeLabel} potty logged at ${time}`, async () => {
        // Undo: delete from cloud and local
        if (cloudEntry?.id && deleteBowelEntry) {
            await deleteBowelEntry(cloudEntry.id);
        }
        deleteBowelMovement(APP.currentDate, cloudEntry?.id || localEntry?.id);
        renderBowelLog();
        renderVisualTimeline();
    });
}

// Log potty with custom time
function logPottyWithTime(type) {
    const timeInput = document.getElementById('pottyTimeInput');
    const timeValue = timeInput.value;

    if (!timeValue) {
        alert('Please select a time first');
        return;
    }

    const { addBowelMovement } = window.DEMO_UTILS;
    addBowelMovement(APP.currentDate, { type, time: timeValue });
    renderBowelLog();

    // Clear the time input
    timeInput.value = '';
}

function openBowelModal() {
    closeQuickMenu();
    APP.selectedBowelType = null;

    document.querySelectorAll('.bowel-option').forEach(b => b.classList.remove('selected'));
    document.getElementById('noteInput').classList.add('hidden');
    document.getElementById('bowelNote').value = '';
    document.getElementById('submitBowel').disabled = true;
    document.getElementById('bowelModal').classList.remove('hidden');
}

function closeBowelModal() {
    document.getElementById('bowelModal').classList.add('hidden');
}

function selectBowelType(type) {
    APP.selectedBowelType = type;

    document.querySelectorAll('.bowel-option').forEach(b => {
        b.classList.toggle('selected', b.dataset.type === type);
    });

    // Show notes input for wet (bad) entries
    document.getElementById('noteInput').classList.toggle('hidden', type !== 'wet');
    document.getElementById('submitBowel').disabled = false;
}

function saveBowel() {
    if (!APP.selectedBowelType) return;

    const notes = document.getElementById('bowelNote').value.trim();

    if (APP.selectedBowelType === 'wet' && !notes) {
        alert('Please add notes for wet entries');
        return;
    }

    const { addBowelMovement } = window.DEMO_UTILS;
    addBowelMovement(APP.currentDate, { type: APP.selectedBowelType, notes });

    closeBowelModal();
    renderBowelLog();
}

function quickBowel(type) {
    closeQuickMenu();

    // Wet entries require a note - open modal
    if (type === 'wet') {
        openBowelModal();
        selectBowelType('wet');
        return;
    }

    const { addBowelMovement } = window.DEMO_UTILS;
    addBowelMovement(APP.currentDate, { type, notes: '' });
    renderBowelLog();
}

function deleteBowel(id) {
    if (!confirm('Delete this entry?')) return;
    const { deleteBowelMovement } = window.DEMO_UTILS;
    deleteBowelMovement(APP.currentDate, id);
    renderBowelLog();
}

// ============================================
// Quick Action Menu
// ============================================

function quickAction() {
    document.getElementById('quickMenu').classList.remove('hidden');
}

function closeQuickMenu() {
    document.getElementById('quickMenu').classList.add('hidden');
}

// ============================================
// Settings
// ============================================

function loadSettings() {
    const { getSettings } = window.DEMO_UTILS;
    const s = getSettings();

    document.getElementById('settingBusPickup').value = s.busPickup || '08:30';
    document.getElementById('settingBusDropoff').value = s.busDropoff || '15:30';
    document.getElementById('settingNannyStart').value = s.nannyHours?.start || '13:00';
    document.getElementById('settingNannyEnd').value = s.nannyHours?.end || '19:00';
}

function openSettings() {
    loadSettings();
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
    const { saveSettings: save } = window.DEMO_UTILS;

    save({
        busPickup: document.getElementById('settingBusPickup').value,
        busDropoff: document.getElementById('settingBusDropoff').value,
        nannyHours: {
            start: document.getElementById('settingNannyStart').value,
            end: document.getElementById('settingNannyEnd').value
        },
        schoolDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    });

    closeSettings();
    renderSchedule();
}

function showHistory() {
    const { getBowelMovementsForDate, formatDateKey, formatShortDate } = window.DEMO_UTILS;
    const { BOWEL_TYPES } = window.DEMO_DATA;

    const content = document.getElementById('historyContent');
    const days = [];

    // Get last 7 days
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const movements = getBowelMovementsForDate(date);

        days.push({
            date,
            dateStr: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatShortDate(date),
            movements,
            count: movements.length,
            hasBad: movements.some(m => m.type === 'bad' || m.type === 'wet')
        });
    }

    // Calculate summary
    const totalMovements = days.reduce((sum, d) => sum + d.count, 0);
    const badDays = days.filter(d => d.hasBad).length;
    const avgPerDay = (totalMovements / 7).toFixed(1);

    content.innerHTML = `
        <div class="history-summary">
            <div class="summary-stat">
                <span class="stat-value">${totalMovements}</span>
                <span class="stat-label">Total (7 days)</span>
            </div>
            <div class="summary-stat">
                <span class="stat-value">${avgPerDay}</span>
                <span class="stat-label">Avg per day</span>
            </div>
            <div class="summary-stat ${badDays > 0 ? 'warning' : ''}">
                <span class="stat-value">${badDays}</span>
                <span class="stat-label">Bad days</span>
            </div>
        </div>
        
        <div class="history-days">
            ${days.map(day => {
        const typeCounts = {};
        day.movements.forEach(m => {
            typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
        });

        return `
                    <div class="history-day ${day.hasBad ? 'has-bad' : ''}">
                        <div class="day-header">
                            <span class="day-date">${day.dateStr}</span>
                            <span class="day-count">${day.count} ${day.count === 1 ? 'entry' : 'entries'}</span>
                        </div>
                        ${day.movements.length > 0 ? `
                            <div class="day-breakdown">
                                ${Object.entries(typeCounts).map(([type, count]) => {
            const typeInfo = BOWEL_TYPES.find(t => t.id === type) || BOWEL_TYPES[0];
            return `<span class="type-chip ${type}">${typeInfo.emoji} ${count}</span>`;
        }).join('')}
                            </div>
                            ${day.movements.filter(m => m.notes).map(m => `
                                <div class="day-note">📝 ${m.notes}</div>
                            `).join('')}
                        ` : '<div class="no-entries">No entries</div>'}
                    </div>
                `;
    }).join('')}
        </div>
    `;

    document.getElementById('historyModal').classList.remove('hidden');
}

function closeHistory() {
    document.getElementById('historyModal').classList.add('hidden');
}

// Tab switching
function showHistoryTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

    if (tab === 'history') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        document.getElementById('historyTab').classList.remove('hidden');
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        document.getElementById('trendsTab').classList.remove('hidden');
        renderTrends();
    }
}

// Trends analysis with day-after correlation
function renderTrends() {
    const { formatDateKey, getBowelMovementsForDate, getSleepForDate, getDayRotation } = window.DEMO_UTILS;
    const { FOOD_DAYS } = window.DEMO_DATA;

    // Initialize data structure for each food day
    // Tracks BOTH same-day AND next-day effects
    const foodStats = {
        1: {
            name: 'Menu A', emoji: '🍽️', class: 'm1',
            sleepGood: 0, sleepBad: 0, pottyGood: 0, pottySoft: 0, pottyWet: 0, days: 0,
            nextSleepGood: 0, nextSleepBad: 0, nextPottyGood: 0, nextPottySoft: 0, nextPottyWet: 0, nextDays: 0
        },
        2: {
            name: 'Menu B', emoji: '🥗', class: 'm2',
            sleepGood: 0, sleepBad: 0, pottyGood: 0, pottySoft: 0, pottyWet: 0, days: 0,
            nextSleepGood: 0, nextSleepBad: 0, nextPottyGood: 0, nextPottySoft: 0, nextPottyWet: 0, nextDays: 0
        },
        3: {
            name: 'Menu C', emoji: '🥙', class: 'm3',
            sleepGood: 0, sleepBad: 0, pottyGood: 0, pottySoft: 0, pottyWet: 0, days: 0,
            nextSleepGood: 0, nextSleepBad: 0, nextPottyGood: 0, nextPottySoft: 0, nextPottyWet: 0, nextDays: 0
        },
        4: {
            name: 'Menu D', emoji: '🥩', class: 'm4',
            sleepGood: 0, sleepBad: 0, pottyGood: 0, pottySoft: 0, pottyWet: 0, days: 0,
            nextSleepGood: 0, nextSleepBad: 0, nextPottyGood: 0, nextPottySoft: 0, nextPottyWet: 0, nextDays: 0
        }
    };

    // Analyze last 30 days
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const dayId = getDayRotation(date);
        const stats = foodStats[dayId];

        // Get same-day sleep data
        const sleep = getSleepForDate(date);
        if (sleep) {
            stats.days++;
            if (sleep.quality === 'good') stats.sleepGood++;
            else if (sleep.quality === 'bad') stats.sleepBad++;
        }

        // Get same-day potty data
        const movements = getBowelMovementsForDate(date);
        movements.forEach(m => {
            if (m.type === 'normal') stats.pottyGood++;
            else if (m.type === 'soft') stats.pottySoft++;
            else if (m.type === 'wet' || m.type === 'bad') stats.pottyWet++;
        });

        // Get NEXT day data (day-after correlation)
        // What happened the day AFTER eating this food?
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const nextSleep = getSleepForDate(nextDate);
        if (nextSleep) {
            stats.nextDays++;
            if (nextSleep.quality === 'good') stats.nextSleepGood++;
            else if (nextSleep.quality === 'bad') stats.nextSleepBad++;
        }

        const nextMovements = getBowelMovementsForDate(nextDate);
        nextMovements.forEach(m => {
            if (m.type === 'normal') stats.nextPottyGood++;
            else if (m.type === 'soft') stats.nextPottySoft++;
            else if (m.type === 'wet' || m.type === 'bad') stats.nextPottyWet++;
        });
    }

    // Render cards with both same-day and next-day analysis
    const container = document.getElementById('trendsContent');
    container.innerHTML = Object.values(foodStats).map(stats => {
        // Same-day percentages
        const sleepTotal = stats.sleepGood + stats.sleepBad;
        const pottyTotal = stats.pottyGood + stats.pottySoft + stats.pottyWet;
        const sleepGoodPct = sleepTotal > 0 ? Math.round((stats.sleepGood / sleepTotal) * 100) : 0;
        const pottyGoodPct = pottyTotal > 0 ? Math.round((stats.pottyGood / pottyTotal) * 100) : 0;

        // Next-day percentages
        const nextSleepTotal = stats.nextSleepGood + stats.nextSleepBad;
        const nextPottyTotal = stats.nextPottyGood + stats.nextPottySoft + stats.nextPottyWet;
        const nextSleepGoodPct = nextSleepTotal > 0 ? Math.round((stats.nextSleepGood / nextSleepTotal) * 100) : 0;
        const nextPottyGoodPct = nextPottyTotal > 0 ? Math.round((stats.nextPottyGood / nextPottyTotal) * 100) : 0;

        return `
            <div class="trend-card ${stats.class}">
                <div class="trend-header">
                    <span class="trend-emoji">${stats.emoji}</span>
                    <span class="trend-title">${stats.name} Day</span>
                    <span class="trend-days">${stats.days} days tracked</span>
                </div>
                
                <div class="trend-section-label">Same Day:</div>
                <div class="trend-metrics">
                    <div class="trend-metric">
                        <span class="metric-label">😴 Sleep</span>
                        <div class="metric-bar">
                            <div class="metric-fill good" style="width: ${sleepGoodPct}%"></div>
                        </div>
                        <span class="metric-value">${sleepGoodPct}%</span>
                    </div>
                    <div class="trend-metric">
                        <span class="metric-label">🚽 Potty</span>
                        <div class="metric-bar">
                            <div class="metric-fill good" style="width: ${pottyGoodPct}%"></div>
                        </div>
                        <span class="metric-value">✅${stats.pottyGood} ⚠️${stats.pottySoft} ❌${stats.pottyWet}</span>
                    </div>
                </div>
                
                <div class="trend-section-label next-day">📅 Day After:</div>
                <div class="trend-metrics">
                    <div class="trend-metric">
                        <span class="metric-label">😴 Sleep</span>
                        <div class="metric-bar">
                            <div class="metric-fill ${nextSleepGoodPct >= 70 ? 'good' : nextSleepGoodPct >= 40 ? 'warning' : 'bad'}" style="width: ${nextSleepGoodPct}%"></div>
                        </div>
                        <span class="metric-value">${nextSleepGoodPct}%</span>
                    </div>
                    <div class="trend-metric">
                        <span class="metric-label">🚽 Potty</span>
                        <div class="metric-bar">
                            <div class="metric-fill ${nextPottyGoodPct >= 70 ? 'good' : nextPottyGoodPct >= 40 ? 'warning' : 'bad'}" style="width: ${nextPottyGoodPct}%"></div>
                        </div>
                        <span class="metric-value">✅${stats.nextPottyGood} ⚠️${stats.nextPottySoft} ❌${stats.nextPottyWet}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Export to CSV
function exportDataCSV() {
    const { formatDateKey, getBowelMovementsForDate, getSleepForDate, getDayRotation, getFoodDayForDate } = window.DEMO_UTILS;

    let csv = 'Date,Food Day,Sleep Quality,Potty Good,Potty Soft,Potty Wet,Notes\n';

    // Export last 90 days
    for (let i = 0; i < 90; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const dateStr = formatDateKey(date);
        const foodDay = getFoodDayForDate(date);
        const sleep = getSleepForDate(date);
        const movements = getBowelMovementsForDate(date);

        const pottyGood = movements.filter(m => m.type === 'normal').length;
        const pottySoft = movements.filter(m => m.type === 'soft').length;
        const pottyWet = movements.filter(m => m.type === 'wet' || m.type === 'bad').length;
        const notes = movements.filter(m => m.notes).map(m => m.notes).join('; ').replace(/,/g, ';');

        csv += `${dateStr},${foodDay.shortName},${sleep?.quality || ''},${pottyGood},${pottySoft},${pottyWet},"${notes}"\n`;
    }

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kid-tracker-${formatDateKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// Schedule Editor
// ============================================

let selectedOverrideDate = null;

function openScheduleEditor() {
    document.getElementById('scheduleModal').classList.remove('hidden');
    renderScheduleGrid();
}

function closeScheduleEditor() {
    document.getElementById('scheduleModal').classList.add('hidden');
}

function renderScheduleGrid() {
    const { formatDateKey, getFoodDayForDate, getScheduleOverrides } = window.DEMO_UTILS;
    const { FOOD_DAYS } = window.DEMO_DATA;
    const overrides = getScheduleOverrides();

    const grid = document.getElementById('scheduleGrid');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = '';

    // Show next 14 days
    for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateKey = formatDateKey(date);

        const override = overrides[dateKey];
        const isSkipped = override === 0;
        const food = getFoodDayForDate(date);

        const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        html += `
            <div class="schedule-day ${i === 0 ? 'today' : ''} ${isSkipped ? 'skipped' : ''}" 
                 onclick="openDayOverride('${dateKey}')">
                <div class="schedule-day-date">
                    <div>${dayName}</div>
                    <div style="font-size: 0.75rem; opacity: 0.7">${dateStr}</div>
                </div>
                <div class="schedule-day-food">
                    <span class="schedule-day-emoji">${isSkipped ? '⏭️' : food.emoji}</span>
                    <span class="schedule-day-name">${isSkipped ? 'Skipping' : food.shortName}</span>
                    ${override !== undefined ? '<span class="schedule-day-override">✏️</span>' : ''}
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
}

function openDayOverride(dateKey) {
    selectedOverrideDate = dateKey;
    document.getElementById('overrideDateDisplay').textContent = formatOverrideDate(dateKey);
    document.getElementById('dayOverrideModal').classList.remove('hidden');
}

function closeDayOverride() {
    document.getElementById('dayOverrideModal').classList.add('hidden');
    selectedOverrideDate = null;
}

function formatOverrideDate(dateKey) {
    const [year, month, day] = dateKey.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function setDayOverride(dayId) {
    if (!selectedOverrideDate) return;

    const { setScheduleOverride, setScheduleAnchor } = window.DEMO_UTILS;
    const resumeNormal = document.getElementById('resumeNormalSchedule').checked;

    // Set the override for this day
    await setScheduleOverride(selectedOverrideDate, dayId);

    // If resume normal is checked, set a new anchor starting from the next day
    if (resumeNormal && dayId !== 0) {
        // Parse the date
        const [year, month, day] = selectedOverrideDate.split('-');
        const overrideDate = new Date(year, month - 1, day);

        // Next day
        const nextDate = new Date(overrideDate);
        nextDate.setDate(nextDate.getDate() + 1);

        // The next day's ID should follow from the selected day (dayId + 1, wrapping at 5)
        const nextDayId = (dayId % 5) + 1;

        // Set the new anchor
        await setScheduleAnchor(nextDate, nextDayId);
    }

    closeDayOverride();
    renderScheduleGrid();
    updateUI(); // Refresh main view in case current day changed
}

async function clearDayOverride() {
    if (!selectedOverrideDate) return;

    const { clearScheduleOverride } = window.DEMO_UTILS;
    await clearScheduleOverride(selectedOverrideDate);

    closeDayOverride();
    renderScheduleGrid();
    updateUI();
}

// ============================================
// Visual Timeline (14-day view)
// ============================================

function renderVisualTimeline() {
    const container = document.getElementById('visualTimeline');
    if (!container) return;

    const { formatDateKey, getFoodDayForDate, getBowelMovementsForDate, getSleepForDate, isToday } = window.DEMO_UTILS;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = `
        <div class="timeline-title">📊 Last 14 Days</div>
        <div class="timeline-grid">
    `;

    // Show 7 days before today through 7 days after
    for (let i = -7; i <= 6; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateKey = formatDateKey(date);

        const food = getFoodDayForDate(date);
        const bowels = getBowelMovementsForDate(date);
        const sleep = getSleepForDate(date);

        const dayNum = date.getDate();
        const isTodayClass = i === 0 ? 'today' : '';

        // Build potty dots
        let pottyDots = '';
        if (bowels && bowels.length > 0) {
            bowels.forEach(b => {
                pottyDots += `<span class="timeline-dot ${b.type}"></span>`;
            });
        } else {
            pottyDots = '<span class="timeline-dot"></span>';
        }

        // Sleep emoji
        const sleepEmoji = sleep?.quality === 'good' ? '😴' : sleep?.quality === 'bad' ? '😫' : '';

        html += `
            <div class="timeline-day ${isTodayClass}" onclick="goToDate('${dateKey}')">
                <span class="timeline-date">${dayNum}</span>
                <span class="timeline-food">${food?.emoji || '?'}</span>
                <div class="timeline-indicators">${pottyDots}</div>
                <span class="timeline-sleep">${sleepEmoji}</span>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function goToDate(dateKey) {
    const [year, month, day] = dateKey.split('-');
    APP.currentDate = new Date(year, month - 1, day, 12, 0, 0);
    loadDataFromCloud();
}

// ============================================
// Pattern Detection & Alerts
// ============================================

function renderPatternAlerts() {
    const container = document.getElementById('patternAlerts');
    if (!container) return;

    const alerts = detectPatterns();

    if (alerts.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = alerts.map(alert => `
        <div class="pattern-alert ${alert.type}">
            <span class="pattern-alert-icon">${alert.icon}</span>
            <span class="pattern-alert-text">${alert.message}</span>
        </div>
    `).join('');
}

function detectPatterns() {
    const { getBowelMovementsForDate, getSleepForDate, formatDateKey } = window.DEMO_UTILS;
    const alerts = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check last 7 days for patterns
    let consecutiveBadBowel = 0;
    let consecutiveBadSleep = 0;
    let softWetDays = [];
    let badSleepDays = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        const bowels = getBowelMovementsForDate(date);
        const sleep = getSleepForDate(date);

        // Check for soft/wet bowel movements
        const hasBadBowel = bowels?.some(b => b.type === 'soft' || b.type === 'wet');
        if (hasBadBowel) {
            if (i <= 1) consecutiveBadBowel++;
            softWetDays.push(date);
        } else {
            if (i <= 1) consecutiveBadBowel = 0;
        }

        // Check for bad sleep
        if (sleep?.quality === 'bad') {
            if (i <= 2) consecutiveBadSleep++;
            badSleepDays.push(date);
        } else {
            if (i <= 2 && consecutiveBadSleep < 2) consecutiveBadSleep = 0;
        }
    }

    // Generate alerts based on patterns
    if (consecutiveBadBowel >= 2) {
        alerts.push({
            type: 'danger',
            icon: '🔴',
            message: `${consecutiveBadBowel} consecutive days with soft/wet BMs - check food or illness`
        });
    } else if (softWetDays.length >= 3) {
        alerts.push({
            type: 'warning',
            icon: '⚠️',
            message: `${softWetDays.length} soft/wet days in the past week`
        });
    }

    if (consecutiveBadSleep >= 2) {
        alerts.push({
            type: 'warning',
            icon: '😫',
            message: `${consecutiveBadSleep} nights of poor sleep in a row`
        });
    } else if (badSleepDays.length >= 3) {
        alerts.push({
            type: 'info',
            icon: '😴',
            message: `${badSleepDays.length} bad sleep nights this week`
        });
    }

    return alerts;
}

// ============================================
// Weekly Report PDF Generation
// ============================================

function generateWeeklyReport() {
    const { formatDateKey, getBowelMovementsForDate, getSleepForDate, getFoodDayForDate } = window.DEMO_UTILS;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Gather data for last 7 days
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 6);

    let totalNormal = 0, totalSoft = 0, totalWet = 0;
    let totalGoodSleep = 0, totalBadSleep = 0;
    let dayRows = '';

    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = formatDateKey(date);

        const food = getFoodDayForDate(date);
        const bowels = getBowelMovementsForDate(date) || [];
        const sleep = getSleepForDate(date);

        // Count bowel types
        const normalCount = bowels.filter(b => b.type === 'normal').length;
        const softCount = bowels.filter(b => b.type === 'soft').length;
        const wetCount = bowels.filter(b => b.type === 'wet').length;

        totalNormal += normalCount;
        totalSoft += softCount;
        totalWet += wetCount;

        // Count sleep
        if (sleep?.quality === 'good') totalGoodSleep++;
        else if (sleep?.quality === 'bad') totalBadSleep++;

        // Format date for display
        const displayDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        // Build row
        dayRows += `
            <tr>
                <td>${displayDate}</td>
                <td>${food?.emoji || '?'} ${food?.name || 'Unknown'}</td>
                <td>
                    ${normalCount > 0 ? `✅ ${normalCount}` : ''}
                    ${softCount > 0 ? `⚠️ ${softCount}` : ''}
                    ${wetCount > 0 ? `❌ ${wetCount}` : ''}
                    ${bowels.length === 0 ? '-' : ''}
                </td>
                <td>${sleep?.quality === 'good' ? '😴 Good' : sleep?.quality === 'bad' ? '😫 Bad' : '-'}</td>
            </tr>
        `;
    }

    // Get notes from the week (simplified - just today's notes)
    const notes = document.getElementById('dailyNotes')?.value || '';

    // Get growth data
    const growthData = getGrowthData();
    const latestGrowth = growthData.length > 0 ? growthData[0] : null;

    // Calculate percentages
    const totalBowel = totalNormal + totalSoft + totalWet;
    const bowelHealthScore = totalBowel > 0 ? Math.round((totalNormal / totalBowel) * 100) : 100;

    // Generate report HTML
    const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Demo Weekly Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                h1 { font-size: 24px; margin-bottom: 8px; color: #1E40AF; }
                .subtitle { color: #64748B; margin-bottom: 24px; }
                .section { margin-bottom: 24px; }
                .section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; }
                .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
                .summary-card { background: #F8FAFC; border-radius: 8px; padding: 16px; text-align: center; }
                .summary-value { font-size: 28px; font-weight: 700; color: #1E293B; }
                .summary-label { font-size: 12px; color: #64748B; text-transform: uppercase; }
                .summary-card.good { background: #DCFCE7; color: #166534; }
                .summary-card.warning { background: #FEF3C7; color: #92400E; }
                .summary-card.danger { background: #FEE2E2; color: #991B1B; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #E2E8F0; }
                th { background: #F8FAFC; font-weight: 600; color: #475569; }
                tr:hover { background: #F8FAFC; }
                .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; }
                @media print { body { padding: 20px; } .no-print { display: none; } }
            </style>
        </head>
        <body>
            <h1>🍽️ Demo Weekly Report</h1>
            <p class="subtitle">${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            
            <div class="summary-grid">
                <div class="summary-card ${bowelHealthScore >= 70 ? 'good' : bowelHealthScore >= 50 ? 'warning' : 'danger'}">
                    <div class="summary-value">${bowelHealthScore}%</div>
                    <div class="summary-label">Bowel Health</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${totalNormal}/${totalSoft}/${totalWet}</div>
                    <div class="summary-label">Good/Soft/Wet</div>
                </div>
                <div class="summary-card ${totalGoodSleep >= 5 ? 'good' : totalGoodSleep >= 3 ? 'warning' : ''}">
                    <div class="summary-value">${totalGoodSleep}/${totalBadSleep}</div>
                    <div class="summary-label">Good/Bad Sleep</div>
                </div>
                ${latestGrowth ? `
                <div class="summary-card">
                    <div class="summary-value">${latestGrowth.weight || '-'} lbs</div>
                    <div class="summary-label">Weight</div>
                </div>
                ` : '<div class="summary-card"><div class="summary-value">-</div><div class="summary-label">Weight</div></div>'}
            </div>
            
            <div class="section">
                <h2 class="section-title">📅 Daily Breakdown</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Food</th>
                            <th>Bowel</th>
                            <th>Sleep</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dayRows}
                    </tbody>
                </table>
            </div>
            
            ${notes ? `
            <div class="section">
                <h2 class="section-title">📝 Notes</h2>
                <p>${notes}</p>
            </div>
            ` : ''}
            
            <div class="footer">
                Generated by Demo Day Tracker • ${new Date().toLocaleString()}
            </div>
            
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHtml);
    printWindow.document.close();
}

// ============================================
// ChatGPT/AI Analysis (via Vercel serverless function)
// ============================================

async function requestAIAnalysis() {
    const insightsContainer = document.getElementById('aiInsightsContent');
    if (!insightsContainer) return;

    insightsContainer.innerHTML = `
        <div class="ai-insights-loading">
            <div class="loading-spinner" style="width:20px;height:20px;border-width:2px;"></div>
            <span>Analyzing patterns...</span>
        </div>
    `;

    try {
        // Gather last 30 days of data
        const data = gatherAnalysisData(30);

        // Call our Vercel serverless function (API key is on server)
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const result = await response.json();
        const insight = result.insight || 'No insights available.';

        insightsContainer.innerHTML = insight;

        // Cache the result with timestamp
        localStorage.setItem('ai_insights_cache', JSON.stringify({
            insight,
            timestamp: Date.now()
        }));

    } catch (error) {
        console.error('AI Analysis error:', error);
        insightsContainer.innerHTML = '⚠️ Unable to generate insights. Please try again later.';
    }
}

function gatherAnalysisData(days) {
    const { formatDateKey, getFoodDayForDate, getBowelMovementsForDate, getSleepForDate, getNotesForDate } = window.DEMO_UTILS;

    const data = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = formatDateKey(date);

        const food = getFoodDayForDate(date);
        const bowels = getBowelMovementsForDate(date);
        const sleep = getSleepForDate(date);
        const notes = getNotesForDate(date);

        data.push({
            date: dateKey,
            food: food?.shortName || 'Unknown',
            potty: {
                good: bowels?.filter(b => b.type === 'normal' || b.type === 'good').length || 0,
                soft: bowels?.filter(b => b.type === 'soft').length || 0,
                wet: bowels?.filter(b => b.type === 'wet' || b.type === 'bad').length || 0
            },
            sleep: sleep?.quality || 'not logged',
            notes: notes || ''
        });
    }

    return data;
}

function buildAnalysisPrompt(data) {
    // Summarize data for the AI
    const foodCounts = {};
    const foodPotty = {};
    const foodSleep = {};

    data.forEach(day => {
        const food = day.food;
        foodCounts[food] = (foodCounts[food] || 0) + 1;

        if (!foodPotty[food]) foodPotty[food] = { good: 0, soft: 0, wet: 0 };
        foodPotty[food].good += day.potty.good;
        foodPotty[food].soft += day.potty.soft;
        foodPotty[food].wet += day.potty.wet;

        if (!foodSleep[food]) foodSleep[food] = { good: 0, bad: 0 };
        if (day.sleep === 'good') foodSleep[food].good++;
        if (day.sleep === 'bad') foodSleep[food].bad++;
    });

    let prompt = `Analyze this ${data.length}-day care tracking summary for a child:\n\n`;

    Object.keys(foodCounts).forEach(food => {
        prompt += `${food} Day (${foodCounts[food]} days):\n`;
        prompt += `  - Potty: ${foodPotty[food].good} good, ${foodPotty[food].soft} soft, ${foodPotty[food].wet} wet\n`;
        prompt += `  - Sleep: ${foodSleep[food].good} good nights, ${foodSleep[food].bad} bad nights\n`;
    });

    // Include recent notes
    const recentNotes = data.filter(d => d.notes).slice(0, 5).map(d => `${d.date}: ${d.notes}`);
    if (recentNotes.length > 0) {
        prompt += `\nRecent notes:\n${recentNotes.join('\n')}`;
    }

    prompt += '\n\nProvide 2-3 brief insights about patterns you notice. Focus on correlations between food types and outcomes.';

    return prompt;
}

function loadCachedInsights() {
    const cached = localStorage.getItem('ai_insights_cache');
    if (cached) {
        try {
            const { insight, timestamp } = JSON.parse(cached);
            // Cache valid for 4 hours
            if (Date.now() - timestamp < 4 * 60 * 60 * 1000) {
                const container = document.getElementById('aiInsightsContent');
                if (container) container.innerHTML = insight;
                return true;
            }
        } catch (e) { }
    }
    return false;
}
