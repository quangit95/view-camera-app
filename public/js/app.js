document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('extract-form');
    const submitBtn = document.getElementById('submit-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultArea = document.getElementById('result-area');
    const videoPreview = document.getElementById('video-preview');
    const downloadBtn = document.getElementById('download-btn');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const presetBtns = document.querySelectorAll('.preset-btn');
    
    // Settings elements
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const testConnectionBtn = document.getElementById('test-connection-btn');
    const testSpinner = document.getElementById('test-spinner');
    const testResultMsg = document.getElementById('test-result-msg');
    const refreshChannelsBtn = document.getElementById('refresh-channels-btn');
    const channelSelect = document.getElementById('channel');

    // Initialize Flatpickr for date inputs
    const flatpickrConfig = {
        enableTime: true,
        dateFormat: "Y-m-d\\TH:i",
        altInput: true,
        altFormat: "d/m/Y H:i",
        time_24hr: true,
        allowInput: true
    };
    
    const startPicker = flatpickr(startTimeInput, flatpickrConfig);
    const endPicker = flatpickr(endTimeInput, flatpickrConfig);

    // Initialize with current time for end time and 5 mins ago for start time
    const initTimes = () => {
        const now = new Date();
        const start = new Date(now.getTime() - 5 * 60000);
        
        startPicker.setDate(start);
        endPicker.setDate(now);
    };

    initTimes();

    // Preset buttons logic
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const minutes = parseInt(btn.getAttribute('data-minutes'));
            const now = new Date();
            const start = new Date(now.getTime() - minutes * 60000);
            
            startPicker.setDate(start);
            endPicker.setDate(now);
            
            // Visual feedback
            btn.classList.add('bg-terracotta', 'text-white', 'border-terracotta');
            setTimeout(() => {
                btn.classList.remove('bg-terracotta', 'text-white', 'border-terracotta');
            }, 300);
        });
    });

    // --- Settings Modal Logic ---
    
    // Load config from API
    const loadConfig = async () => {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const config = await res.json();
                document.getElementById('nvrType').value = config.nvrType || 'hikvision';
                document.getElementById('nvrIp').value = config.nvrIp || '';
                document.getElementById('httpPort').value = config.httpPort || '80';
                document.getElementById('nvrPort').value = config.nvrPort || '554';
                document.getElementById('nvrUsername').value = config.nvrUsername || '';
                // Intentionally leave password blank or filled with placeholder based on backend return
                document.getElementById('nvrPassword').value = config.nvrPassword || '';
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    };

    // Open settings modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        settingsModal.classList.add('flex');
        loadConfig();
    });

    // Close settings modal
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        settingsModal.classList.remove('flex');
        testResultMsg.classList.add('hidden');
    });

    // Test Connection
    testConnectionBtn.addEventListener('click', async () => {
        const configData = {
            nvrType: document.getElementById('nvrType').value,
            nvrIp: document.getElementById('nvrIp').value,
            httpPort: document.getElementById('httpPort').value,
            nvrPort: document.getElementById('nvrPort').value,
            nvrUsername: document.getElementById('nvrUsername').value,
            nvrPassword: document.getElementById('nvrPassword').value,
        };

        if (!configData.nvrIp || !configData.nvrUsername || !configData.nvrPassword) {
            alert('Please fill in all connection details before testing.');
            return;
        }

        testConnectionBtn.disabled = true;
        testSpinner.classList.remove('hidden');
        testResultMsg.classList.add('hidden');
        testResultMsg.className = 'text-center text-sm mt-2 font-medium transition-all'; // Reset classes

        try {
            const res = await fetch('/api/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData)
            });
            
            const data = await res.json();
            
            testResultMsg.classList.remove('hidden');
            if (res.ok && data.success) {
                testResultMsg.textContent = 'Connection Successful! NVR is reachable.';
                testResultMsg.classList.add('text-green-500');
            } else {
                testResultMsg.textContent = data.error || 'Connection Failed!';
                testResultMsg.classList.add('text-red-500');
            }
        } catch (error) {
            console.error(error);
            testResultMsg.classList.remove('hidden');
            testResultMsg.textContent = 'Error testing connection. Ensure server is running.';
            testResultMsg.classList.add('text-red-500');
        } finally {
            testConnectionBtn.disabled = false;
            testSpinner.classList.add('hidden');
        }
    });

    // Save settings
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const configData = {
            nvrType: document.getElementById('nvrType').value,
            nvrIp: document.getElementById('nvrIp').value,
            httpPort: document.getElementById('httpPort').value,
            nvrPort: document.getElementById('nvrPort').value,
            nvrUsername: document.getElementById('nvrUsername').value,
            nvrPassword: document.getElementById('nvrPassword').value,
        };

        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData)
            });
            
            if (res.ok) {
                settingsToast.classList.remove('hidden');
                setTimeout(() => {
                    settingsToast.classList.add('hidden');
                    settingsModal.classList.add('hidden');
                    settingsModal.classList.remove('flex');
                }, 1500);
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error(error);
            alert('Error saving configuration.');
        }
    });

    // Refresh Channels
    refreshChannelsBtn.addEventListener('click', async () => {
        const icon = refreshChannelsBtn.querySelector('i');
        icon.classList.add('fa-spin');
        refreshChannelsBtn.disabled = true;

        try {
            const res = await fetch('/api/channels');
            const data = await res.json();
            
            if (res.ok && data.success) {
                // Clear existing options
                channelSelect.innerHTML = '<option value="" disabled selected>Select an option...</option>';
                
                // Add new options
                data.channels.forEach(ch => {
                    const opt = document.createElement('option');
                    opt.value = ch.id;
                    opt.textContent = ch.name;
                    channelSelect.appendChild(opt);
                });
                
                alert(`Successfully loaded ${data.channels.length} cameras.`);
            } else {
                alert(data.error || 'Failed to fetch channels.');
            }
        } catch (err) {
            console.error(err);
            alert('Error communicating with the server.');
        } finally {
            icon.classList.remove('fa-spin');
            refreshChannelsBtn.disabled = false;
        }
    });

    // Form submission for extraction
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const channel = document.getElementById('channel').value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (!channel) {
            alert('Please select a camera/channel.');
            return;
        }

        if (new Date(endTime) <= new Date(startTime)) {
            alert('End time must be after start time.');
            return;
        }

        // UI State: Loading
        form.style.display = 'none';
        resultArea.classList.add('hidden');
        resultArea.classList.remove('animate-fade-in');
        loadingIndicator.classList.remove('hidden');
        loadingIndicator.classList.add('flex');

        try {
            // Convert local datetime to UTC ISO string to pass to the API
            const startISO = new Date(startTime).toISOString();
            const endISO = new Date(endTime).toISOString();
            
            const videoUrl = `/api/stream?channel=${encodeURIComponent(channel)}&start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
            const downloadUrl = `${videoUrl}&download=1`;
            
            // Assign source directly
            videoPreview.src = videoUrl;
            downloadBtn.href = downloadUrl;
            
            // Wait for video to be ready before showing UI
            videoPreview.oncanplay = () => {
                if (loadingIndicator.classList.contains('flex')) {
                    loadingIndicator.classList.add('hidden');
                    loadingIndicator.classList.remove('flex');
                    
                    resultArea.classList.remove('hidden');
                    resultArea.classList.add('animate-fade-in');
                    form.style.display = 'block'; // Show form again for new extractions
                }
            };
            
            videoPreview.onerror = (e) => {
                console.error('Video preview error:', e);
                alert("Error loading video stream. Please ensure the NVR has a recording for this exact time period, or try a different camera.");
                
                // Hide result area if video fails
                loadingIndicator.classList.add('hidden');
                loadingIndicator.classList.remove('flex');
                resultArea.classList.add('hidden');
                form.style.display = 'block';
            };

            // In case video doesn't trigger oncanplay quickly, fallback
            setTimeout(() => {
                if (loadingIndicator.classList.contains('flex')) {
                    loadingIndicator.classList.add('hidden');
                    loadingIndicator.classList.remove('flex');
                    resultArea.classList.remove('hidden');
                    resultArea.classList.add('animate-fade-in');
                    form.style.display = 'block';
                }
            }, 5000);

        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
            
            // Revert UI State
            loadingIndicator.classList.add('hidden');
            loadingIndicator.classList.remove('flex');
            form.style.display = 'block';
        }
    });
});
