// ============================================
// Demo Dashboard - Supabase Integration
// ============================================
(function () {
    // Supabase Client Configuration
    const SUPABASE_URL = 'https://dummy-project-url.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-anon-key.dummy-signature';

    // Initialize Supabase client (using CDN version)
    // Using _supabase to avoid conflict with window.supabase from CDN
    let _supabase = null;

    function initSupabase() {
        console.log('Attempting Supabase init...');

        // Check for Supabase v2 CDN (exposes createClient directly on window.supabase)
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase initialized successfully');
            return true;
        }

        console.warn('⚠️ Supabase library not found, using localStorage only');
        console.log('window.supabase =', window.supabase);
        return false;
    }

    // ============================================
    // Offline Sync Manager
    // ============================================
    const SYNC_QUEUE_KEY = 'demo_sync_queue';
    let isProcessingQueue = false;

    // Load queue from local storage
    function getSyncQueue() {
        try {
            return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    // Save queue to local storage
    function saveSyncQueue(queue) {
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }

    // Add item to queue
    function addToSyncQueue(operation, params) {
        const queue = getSyncQueue();
        queue.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            operation,
            params,
            timestamp: Date.now(),
            attempts: 0
        });
        saveSyncQueue(queue);
        processSyncQueue();
    }

    // Process the queue
    async function processSyncQueue() {
        if (isProcessingQueue || !_supabase || !navigator.onLine) return;

        const queue = getSyncQueue();
        if (queue.length === 0) return;

        isProcessingQueue = true;
        console.log(`📡 Processing sync queue (${queue.length} items)...`);

        const newQueue = [];
        let successCount = 0;

        for (const item of queue) {
            try {
                // Determine which function to call
                let result;
                if (item.operation === 'setMedicineCheck') {
                    // We call the 'raw' version which talks to Supabase directly
                    result = await rawSetMedicineCheck(item.params.dateKey, item.params.slot, item.params.medicineName, item.params.checked);
                } else if (item.operation === 'syncBowelLog') {
                    result = await rawSyncBowelLog(item.params.dateKey, item.params.log);
                } else if (item.operation === 'syncDailyNotes') {
                    result = await rawSyncDailyNotes(item.params.dateKey, item.params.notes);
                } else if (item.operation === 'syncBehaviors') {
                    result = await rawSyncBehaviors(item.params.dateKey, item.params.tags);
                } else if (item.operation === 'syncSettings') {
                    result = await rawSyncSettings(item.params.settings);
                }

                // If we got here without throwing, it was successful
                successCount++;
            } catch (err) {
                console.error('❌ Sync failed for item:', item, err);
                item.attempts++;
                // If it's a network error (usually has no status or 5xx), keep in queue
                // If it's a 4xx error (bad request), maybe drop it? keeping it safe for now.
                if (item.attempts < 20) {
                    newQueue.push(item);
                }
            }
        }

        saveSyncQueue(newQueue);
        isProcessingQueue = false;

        if (successCount > 0) {
            console.log(`✅ Successfully synced ${successCount} items`);
            // Trigger UI update if needed (optional)
            if (window.updateSyncStatus) window.updateSyncStatus('connected');
        }
    }

    // Listen for online status
    window.addEventListener('online', () => {
        console.log('🌐 Back online! Processing queue...');
        processSyncQueue();
    });

    // Retry every minute
    setInterval(processSyncQueue, 60 * 1000);

    // ============================================
    // Database Operations - CLOUD FIRST
    // ============================================

    // Medicine Checks - Individual checkbox records for multi-user
    // Medicine Checks - Individual checkbox records for multi-user
    async function rawSetMedicineCheck(dateKey, slot, medicineName, checked) {
        if (!_supabase) return null;

        try {
            const { data, error } = await _supabase
                .from('medicine_checks')
                .upsert({
                    date: dateKey,
                    slot: slot,
                    medicine_name: medicineName,
                    checked: checked,
                    checked_at: checked ? new Date().toISOString() : null,
                    checked_by: 'user'
                }, { onConflict: 'date,slot,medicine_name' })
                .select()
                .single();

            if (error) throw error;
            console.log('✅ Medicine check synced:', medicineName, checked);
            return data;
        } catch (err) {
            console.error('Error setting medicine check:', err);
            throw err; // Re-throw for queue handling
        }
    }

    async function setMedicineCheck(dateKey, slot, medicineName, checked) {
        // 1. Add to Offline Queue & Attempt Sync
        addToSyncQueue('setMedicineCheck', { dateKey, slot, medicineName, checked });

        // 2. Return success immediately (Optimistic UI)
        return { success: true, offline: true };
    }

    async function fetchMedicineChecks(dateKey) {
        if (!_supabase) return [];

        try {
            const { data, error } = await _supabase
                .from('medicine_checks')
                .select('*')
                .eq('date', dateKey);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching medicine checks:', err);
            return [];
        }
    }

    // Legacy medicine status functions (for backwards compatibility)
    async function syncMedicineStatus(dateKey, data) {
        // Deprecated - convert to individual checks if needed
        console.warn('syncMedicineStatus is deprecated, use setMedicineCheck');
        return true;
    }

    async function fetchMedicineStatus(dateKey) {
        // Try new system first, fall back to legacy
        const checks = await fetchMedicineChecks(dateKey);
        if (checks.length > 0) {
            // Convert to old format for compatibility
            const status = {};
            checks.forEach(c => {
                if (!status[c.slot]) status[c.slot] = {};
                status[c.slot][c.medicine_name] = c.checked;
            });
            return status;
        }
        return null;
    }

    // Medicines Configuration
    async function syncMedicines(dateKey, medicines) {
        // If only one argument is passed, it is the config and date is 'default'
        if (arguments.length === 1) {
            medicines = dateKey;
            dateKey = 'default';
        }

        if (!_supabase) return false;

        try {
            const { error } = await _supabase
                .from('medicines')
                .upsert({
                    date: dateKey,
                    config: medicines,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'date' });

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Error syncing medicines:', err);
            return false;
        }
    }

    async function fetchMedicines(dateKey = 'default') {
        if (!_supabase) return null;

        try {
            const { data, error } = await _supabase
                .from('medicines')
                .select('config')
                .eq('date', dateKey)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            return data?.config || null;
        } catch (err) {
            console.error('Error fetching medicines:', err);
            return null;
        }
    }

    // Bowel Movements - Individual record pattern for multi-user
    async function addBowelEntry(dateKey, entry) {
        if (!_supabase) {
            console.error('❌ addBowelEntry: Supabase not initialized!');
            return null;
        }

        console.log('📤 Saving bowel entry to cloud:', dateKey, entry);

        try {
            const { data, error } = await _supabase
                .from('bowel_entries')
                .insert({
                    date: dateKey,
                    time: entry.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    type: entry.type,
                    notes: entry.notes || '',
                    created_by: 'user'
                })
                .select()
                .single();

            if (error) {
                console.error('❌ Supabase error saving bowel entry:', error);
                throw error;
            }
            console.log('✅ Bowel entry synced to cloud:', data.id);
            return data;
        } catch (err) {
            console.error('❌ Error adding bowel entry:', err);
            return null;
        }
    }

    async function deleteBowelEntry(entryId) {
        if (!_supabase) return false;

        try {
            const { error } = await _supabase
                .from('bowel_entries')
                .delete()
                .eq('id', entryId);

            if (error) throw error;
            console.log('🗑️ Bowel entry deleted from cloud:', entryId);
            return true;
        } catch (err) {
            console.error('Error deleting bowel entry:', err);
            return false;
        }
    }

    async function fetchBowelEntries(dateKey) {
        if (!_supabase) return [];

        try {
            const { data, error } = await _supabase
                .from('bowel_entries')
                .select('*')
                .eq('date', dateKey)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching bowel entries:', err);
            return [];
        }
    }

    // Bowel Movements - Bulk Sync (Preferred for v1.0 stability)
    async function rawSyncBowelLog(dateKey, log) {
        if (!_supabase) return null;

        try {
            // We need to upsert each entry individually or manage a 'daily_log' table
            // Since we have 'bowel_entries' table which is individual rows, bulk sync is tricky.
            // Strategy: We will delete all for date and re-insert (safe but heavy)
            // OR: we trust the client's log is authoritative.

            // For v1.0 stability, let's just loop upsert them.
            const upserts = log.map(entry => ({
                date_key: dateKey,
                id: entry.id || crypto.randomUUID(),
                type: entry.type,
                time: entry.time,
                notes: entry.notes || '',
                timestamp: entry.timestamp || new Date().toISOString()
            }));

            if (upserts.length === 0) return true;

            const { error } = await _supabase
                .from('bowel_entries')
                .upsert(upserts, { onConflict: 'id' });

            if (error) throw error;
            console.log(`✅ Synced ${upserts.length} bowel entries`);
            return true;
        } catch (err) {
            console.error('Error syncing bowel log:', err);
            throw err;
        }
    }

    // Legacy function for backwards compatibility (will be removed)
    async function syncBowelMovements(dateKey, movements) {
        // Enqueue the sync
        addToSyncQueue('syncBowelLog', { dateKey, log: movements });
        return { success: true, offline: true };
    }

    async function fetchBowelMovements(dateKey) {
        // Use new individual records system
        return await fetchBowelEntries(dateKey);
    }


    // Settings
    // Settings
    async function rawSyncSettings(settings) {
        if (!_supabase) return false;

        try {
            const { error } = await _supabase
                .from('settings')
                .upsert({
                    id: 'default',
                    config: settings,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (error) throw error;
            console.log('✅ Settings synced');
            return true;
        } catch (err) {
            console.error('Error syncing settings:', err);
            throw err;
        }
    }

    async function syncSettings(settings) {
        addToSyncQueue('syncSettings', { settings });
        return { success: true, offline: true };
    }

    async function fetchSettings() {
        if (!_supabase) return null;

        try {
            const { data, error } = await _supabase
                .from('settings')
                .select('config')
                .eq('id', 'default')
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            return data?.config || null;
        } catch (err) {
            console.error('Error fetching settings:', err);
            return null;
        }
    }

    // ============================================
    // Sleep Quality
    // ============================================

    async function syncSleep(dateKey, sleepData) {
        if (!_supabase) return;

        try {
            const { error } = await _supabase
                .from('sleep_quality')
                .upsert({
                    date_key: dateKey,
                    quality: sleepData.quality,
                    timestamp: sleepData.timestamp,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'date_key' });

            if (error) throw error;
            console.log('😴 Sleep synced to cloud');
        } catch (err) {
            console.error('Error syncing sleep:', err);
        }
    }

    async function fetchSleep(dateKey) {
        if (!_supabase) return null;

        try {
            const { data, error } = await _supabase
                .from('sleep_quality')
                .select('*')
                .eq('date_key', dateKey)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            return data ? { quality: data.quality, timestamp: data.timestamp } : null;
        } catch (err) {
            console.error('Error fetching sleep:', err);
            return null;
        }
    }

    // ============================================
    // Real-time Subscriptions
    // ============================================

    function subscribeToChanges(table, callback) {
        if (!_supabase) return null;

        return _supabase
            .channel(`${table}_changes`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: table },
                (payload) => {
                    console.log(`${table} changed:`, payload);
                    callback(payload);
                }
            )
            .subscribe();
    }

    // ============================================
    // Behaviors
    // ============================================
    async function rawSyncBehaviors(dateKey, tags) {
        if (!_supabase) return false;

        try {
            const { error } = await _supabase
                .from('daily_behaviors')
                .upsert({
                    date: dateKey,
                    tags: tags,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'date' });

            if (error) throw error;
            console.log('✅ Behaviors synced');
            return true;
        } catch (err) {
            console.error('Error syncing behaviors:', err);
            throw err;
        }
    }

    async function syncBehaviors(dateKey, tags) {
        addToSyncQueue('syncBehaviors', { dateKey, tags });
        return { success: true, offline: true };
    }

    async function fetchBehaviors(dateKey) {
        if (!_supabase) return null;

        try {
            const { data, error } = await _supabase
                .from('daily_behaviors')
                .select('tags')
                .eq('date', dateKey)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            return data?.tags || [];
        } catch (err) {
            console.error('Error fetching behaviors:', err);
            return [];
        }
    }

    // Daily Notes
    // Daily Notes
    async function rawSyncDailyNotes(dateKey, notes) {
        if (!_supabase) return false;

        try {
            const { error } = await _supabase
                .from('daily_notes')
                .upsert({
                    date: dateKey,
                    notes: notes,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'date' });

            if (error) throw error;
            console.log('✅ Notes synced');
            return true;
        } catch (err) {
            console.error('Error syncing notes:', err);
            throw err;
        }
    }

    async function syncNotes(dateKey, notes) {
        // Enqueue
        addToSyncQueue('syncDailyNotes', { dateKey, notes });
        return { success: true, offline: true };
    }

    async function fetchNotes(dateKey) {
        if (!_supabase) return null;

        try {
            const { data, error } = await _supabase
                .from('daily_notes')
                .select('notes')
                .eq('date', dateKey)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            return data?.notes || null;
        } catch (err) {
            console.error('Error fetching notes:', err);
            return null;
        }
    }

    // ============================================
    // DATA RECOVERY - Push all localStorage to Cloud
    // ============================================

    async function pushAllLocalDataToCloud() {
        if (!_supabase) {
            console.error('❌ Supabase not initialized');
            return { success: false, error: 'Supabase not initialized' };
        }

        const results = {
            bowel: { pushed: 0, errors: 0 },
            sleep: { pushed: 0, errors: 0 },
            notes: { pushed: 0, errors: 0 },
            medicines: { pushed: 0, errors: 0 }
        };

        console.log('🔄 Starting data recovery - pushing all localStorage to cloud...');

        // 1. Push all bowel entries
        try {
            const bowelData = JSON.parse(localStorage.getItem('demo_bowel') || '{}');
            for (const [dateKey, entries] of Object.entries(bowelData)) {
                if (Array.isArray(entries)) {
                    for (const entry of entries) {
                        // Skip entries without a type (invalid data)
                        if (!entry.type) {
                            console.warn('⚠️ Skipping bowel entry without type:', dateKey, entry);
                            results.bowel.errors++;
                            continue;
                        }
                        try {
                            await addBowelEntry(dateKey, {
                                type: entry.type,
                                time: entry.time,
                                notes: entry.notes || ''
                            });
                            results.bowel.pushed++;
                        } catch (e) {
                            console.error('❌ Failed to sync bowel entry:', e);
                            results.bowel.errors++;
                        }
                    }
                }
            }
            console.log(`✅ Bowel entries: ${results.bowel.pushed} pushed, ${results.bowel.errors} errors`);
        } catch (e) {
            console.error('Error pushing bowel data:', e);
        }

        // 2. Push all sleep data
        try {
            const sleepData = JSON.parse(localStorage.getItem('demo_sleep') || '{}');
            for (const [dateKey, data] of Object.entries(sleepData)) {
                if (data?.quality) {
                    try {
                        await syncSleep(dateKey, data);
                        results.sleep.pushed++;
                    } catch (e) {
                        results.sleep.errors++;
                    }
                }
            }
            console.log(`✅ Sleep entries: ${results.sleep.pushed} pushed, ${results.sleep.errors} errors`);
        } catch (e) {
            console.error('Error pushing sleep data:', e);
        }

        // 3. Push all notes
        try {
            const notesData = JSON.parse(localStorage.getItem('demo_notes') || '{}');
            for (const [dateKey, notes] of Object.entries(notesData)) {
                if (notes) {
                    try {
                        await syncNotes(dateKey, notes);
                        results.notes.pushed++;
                    } catch (e) {
                        results.notes.errors++;
                    }
                }
            }
            console.log(`✅ Notes entries: ${results.notes.pushed} pushed, ${results.notes.errors} errors`);
        } catch (e) {
            console.error('Error pushing notes data:', e);
        }

        // 4. Push medicine status
        try {
            const medData = JSON.parse(localStorage.getItem('demo_medicine_status') || '{}');
            for (const [dateKey, dayData] of Object.entries(medData)) {
                if (typeof dayData === 'object') {
                    for (const [slot, meds] of Object.entries(dayData)) {
                        if (typeof meds === 'object') {
                            for (const [medName, checked] of Object.entries(meds)) {
                                if (checked) {
                                    try {
                                        await setMedicineCheck(dateKey, slot, medName, checked);
                                        results.medicines.pushed++;
                                    } catch (e) {
                                        results.medicines.errors++;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            console.log(`✅ Medicine checks: ${results.medicines.pushed} pushed, ${results.medicines.errors} errors`);
        } catch (e) {
            console.error('Error pushing medicine data:', e);
        }

        console.log('🎉 Data recovery complete!', results);
        return { success: true, results };
    }

    // ============================================
    // Food Day Customizations
    // ============================================

    async function syncFoodCustomizations(dayId, categories) {
        if (!_supabase) return null;

        try {
            const { data, error } = await _supabase
                .from('food_customizations')
                .upsert({
                    day_id: dayId,
                    categories: categories,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'day_id' })
                .select()
                .single();

            if (error) throw error;
            console.log(`🍽️ Food day ${dayId} customizations synced to cloud`);
            return data;
        } catch (err) {
            console.error('Error syncing food customizations:', err);
            return null;
        }
    }

    async function fetchFoodCustomizations() {
        if (!_supabase) return null;

        try {
            const { data, error } = await _supabase
                .from('food_customizations')
                .select('*');

            if (error) throw error;

            // Convert array to object keyed by day_id
            const customizations = {};
            if (data) {
                data.forEach(item => {
                    customizations[item.day_id] = item.categories;
                });
            }

            console.log('🍽️ Fetched food customizations from cloud:', customizations);
            return customizations;
        } catch (err) {
            console.error('Error fetching food customizations:', err);
            return null;
        }
    }

    // Export
    if (typeof window !== 'undefined') {
        window.DEMO_SUPABASE = {
            initSupabase,
            // Medicine checks - individual records
            setMedicineCheck,
            fetchMedicineChecks,
            // Legacy medicine (deprecated)
            syncMedicineStatus,
            fetchMedicineStatus,
            syncMedicines,
            fetchMedicines,
            // Bowel entries - individual records
            addBowelEntry,
            deleteBowelEntry,
            fetchBowelEntries,
            // Legacy bowel (deprecated)
            syncBowelMovements,
            fetchBowelMovements,
            // Sleep & Notes (upsert by date)
            syncSleep,
            fetchSleep,
            syncNotes,
            fetchNotes,
            // Daily Behaviors
            syncBehaviors,
            fetchBehaviors,
            // Other
            syncSettings,
            fetchSettings,
            subscribeToChanges,
            // Food customizations
            syncFoodCustomizations,
            fetchFoodCustomizations,
            // Data recovery
            pushAllLocalDataToCloud
        };
    }
})();
