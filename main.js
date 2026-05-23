// Firebase Configuration - Replace with your actual config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "globalgoal2026.firebaseapp.com",
    projectId: "globalgoal2026",
    storageBucket: "globalgoal2026.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let auth, db;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
} catch (e) {
    console.log('Firebase not configured yet. Using localStorage fallback.');
}

// Global state
let currentUser = null;
let userData = null;
let userPoints = 1250;
let isLoggedIn = false;

// Initialize
function initApp() {
    // Check Firebase auth state
    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                isLoggedIn = true;
                loadUserData(user.uid);
            } else {
                currentUser = null;
                isLoggedIn = false;
                loadLocalData();
            }
            updateUI();
        });
    } else {
        loadLocalData();
        updateUI();
    }

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    // Fade in animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// Load user data from Firestore
async function loadUserData(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            userData = doc.data();
            userPoints = userData.points || 0;
        } else {
            // Create new user document
            userData = {
                uid: uid,
                email: currentUser.email,
                displayName: currentUser.displayName || 'User',
                photoURL: currentUser.photoURL || '',
                points: 0,
                tasksCompleted: 0,
                referrals: 0,
                videosWatched: 0,
                referralCount: 0,
                referralCode: generateReferralCode(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastCheckin: null,
                youtubeVerified: false,
                newsletterSubscribed: false,
                watchedVideos: [],
                redeemedPrizes: []
            };
            await db.collection('users').doc(uid).set(userData);
            userPoints = 0;
        }
        updateNavPoints();
    } catch (e) {
        console.error('Error loading user data:', e);
        loadLocalData();
    }
}

// Load from localStorage (fallback)
function loadLocalData() {
    const saved = localStorage.getItem('gg_user_data');
    if (saved) {
        userData = JSON.parse(saved);
        userPoints = userData.points || 1250;
    } else {
        userData = {
            points: 1250,
            tasksCompleted: 5,
            referrals: 2,
            videosWatched: 3,
            referralCount: 2,
            referralCode: 'GG8X2K9M',
            lastCheckin: null,
            youtubeVerified: false,
            newsletterSubscribed: false,
            watchedVideos: [],
            redeemedPrizes: []
        };
    }
    updateNavPoints();
}

// Save to localStorage
function saveLocalData() {
    if (userData) {
        userData.points = userPoints;
        localStorage.setItem('gg_user_data', JSON.stringify(userData));
    }
}

// Generate referral code
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'GG';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Update UI based on auth state
function updateUI() {
    updateNavPoints();

    // Update nav links based on auth
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        const authBtn = navLinks.querySelector('.auth-btn');
        if (isLoggedIn && currentUser) {
            // Show user profile instead of login
            if (authBtn) {
                authBtn.innerHTML = `<div class="user-points" onclick="location.href='profile.html'"><span class="points-icon">👤</span><span>${currentUser.displayName || 'Profile'}</span></div>`;
            }
        }
    }
}

// Update nav points display
function updateNavPoints() {
    const navPoints = document.getElementById('nav-points');
    if (navPoints) {
        navPoints.textContent = userPoints.toLocaleString();
    }

    // Update stat displays on earn-points page
    const statPoints = document.getElementById('stat-points');
    if (statPoints) statPoints.textContent = userPoints.toLocaleString();

    const statTasks = document.getElementById('stat-tasks');
    if (statTasks) statTasks.textContent = userData?.tasksCompleted || 5;

    const statReferrals = document.getElementById('stat-referrals');
    if (statReferrals) statReferrals.textContent = userData?.referralCount || 2;

    const statVideos = document.getElementById('stat-videos');
    if (statVideos) statVideos.textContent = userData?.videosWatched || 3;

    // Update your rank on leaderboard
    const yourPoints = document.getElementById('your-points');
    if (yourPoints) yourPoints.textContent = userPoints.toLocaleString();
}

// Add points
async function addPoints(amount, reason) {
    userPoints += amount;

    if (auth && currentUser && db) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                points: firebase.firestore.FieldValue.increment(amount),
                tasksCompleted: firebase.firestore.FieldValue.increment(1)
            });
        } catch (e) {
            console.error('Error updating points:', e);
        }
    }

    saveLocalData();
    updateNavPoints();
    showNotification('Points Earned!', `+${amount} points for ${reason}`, 'success');
}

// Claim daily check-in
function claimDaily() {
    const today = new Date().toDateString();
    const lastCheckin = userData?.lastCheckin;

    if (lastCheckin === today) {
        showNotification('Already Claimed', 'Come back tomorrow for more points!', 'error');
        return;
    }

    userData.lastCheckin = today;
    addPoints(20, 'Daily Check-in');

    const btn = document.getElementById('btn-daily');
    const status = document.getElementById('status-daily');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.textContent = 'Claimed Today';
    }
    if (status) {
        status.textContent = 'Completed';
        status.className = 'task-status completed';
    }

    saveLocalData();
}

// Verify YouTube subscription
function verifyYouTube(username) {
    if (!username || username.trim() === '') {
        showNotification('Error', 'Please enter your YouTube username', 'error');
        return;
    }

    if (userData?.youtubeVerified) {
        showNotification('Already Done', 'You already claimed this bonus.', 'error');
        return;
    }

    userData.youtubeVerified = true;
    userData.youtubeUsername = username;

    const status = document.getElementById('status-youtube');
    if (status) {
        status.textContent = 'Pending Verification';
        status.className = 'task-status completed';
    }

    addPoints(100, 'YouTube Subscription');
    saveLocalData();

    showNotification('Submitted!', 'Your YouTube subscription is being verified. Points will be added within 24 hours.', 'success');
}

// Copy referral link
function copyReferralLink() {
    const refLink = document.getElementById('ref-link');
    if (refLink) {
        refLink.select();
        navigator.clipboard.writeText(refLink.value).then(() => {
            showNotification('Copied!', 'Referral link copied to clipboard.', 'success');
        });
    }
}

// Handle newsletter subscription
function handleSubscribe(e) {
    if (e) e.preventDefault();
    const emailInput = document.querySelector('.newsletter-input');
    const email = emailInput ? emailInput.value : '';

    if (!email || !email.includes('@')) {
        showNotification('Invalid Email', 'Please enter a valid email.', 'error');
        return;
    }

    if (userData?.newsletterSubscribed) {
        showNotification('Already Subscribed', 'You already claimed this bonus.', 'error');
        return;
    }

    userData.newsletterSubscribed = true;
    userData.newsletterEmail = email;
    addPoints(50, 'Newsletter Subscription');
    saveLocalData();

    if (emailInput) emailInput.value = '';
    showNotification('Subscribed!', 'Welcome to the newsletter! +50 points added.', 'success');
}

// Mobile menu toggle
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// Explore city
function exploreCity(city) {
    showNotification('Coming Soon', `Explore ${city.toUpperCase()} feature launching soon!`, 'success');
}

// Notification system
function showNotification(title, message, type = 'success') {
    // Remove existing notifications
    const existing = document.querySelector('.gg-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `gg-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    // Auto remove
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Leaderboard data - generates 1000 entries
function generateLeaderboardData() {
    const names = [
        'James_Dawson', 'Maria_Kicks', 'Alex_Lion', 'Sam_Rooney', 'Toni_Cruz',
        'Liam_Walker', 'Sarah_Okafor', 'David_Kim', 'Elena_Patel', 'Carlos_Martinez',
        'Emma_Thompson', 'Lucas_Silva', 'Sophie_Chen', 'Ahmed_Hassan', 'Isabella_Rossi',
        'Noah_Williams', 'Aisha_Mohamed', 'Oliver_Brown', 'Zara_Ali', 'Ethan_Davis',
        'Mia_Johnson', 'Daniel_Garcia', 'Chloe_Wilson', 'Ryan_Lee', 'Grace_Taylor',
        'Jack_Anderson', 'Lily_Thomas', 'Benjamin_Jackson', 'Aria_White', 'Mason_Harris',
        'Zoe_Martin', 'Logan_Thompson', 'Nora_Garcia', 'Jacob_Martinez', 'Ava_Robinson',
        'William_Clark', 'Emily_Rodriguez', 'Michael_Lewis', 'Harper_Lee', 'Alexander_Walker',
        'Evelyn_Hall', 'Daniel_Young', 'Abigail_King', 'Matthew_Wright', 'Elizabeth_Lopez',
        'Henry_Hill', 'Sofia_Scott', 'Joseph_Green', 'Victoria_Adams', 'Samuel_Baker'
    ];

    const leaderboard = [];

    // Generate 1000 entries with decreasing points
    for (let i = 0; i < 1000; i++) {
        const nameIndex = i % names.length;
        const suffix = Math.floor(i / names.length) > 0 ? `_${Math.floor(i / names.length)}` : '';
        const basePoints = Math.max(15000 - (i * 15), 50);
        const randomVariation = Math.floor(Math.random() * 100) - 50;

        leaderboard.push({
            rank: i + 1,
            name: names[nameIndex] + suffix,
            initials: names[nameIndex].substring(0, 2).toUpperCase(),
            points: Math.max(basePoints + randomVariation, 10),
            badge: i < 10 ? 'VIP' : i < 50 ? 'Active' : i < 100 ? 'Rising' : 'Fan',
            avatarColor: `hsl(${(i * 137.5) % 360}, 70%, 60%)`
        });
    }

    return leaderboard;
}

// Get leaderboard data (cached)
function getLeaderboardData() {
    const cached = localStorage.getItem('gg_leaderboard');
    if (cached) {
        return JSON.parse(cached);
    }
    const data = generateLeaderboardData();
    localStorage.setItem('gg_leaderboard', JSON.stringify(data));
    return data;
}

// Render leaderboard
function renderLeaderboard(containerId, limit = 50, offset = 0) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = getLeaderboardData();
    const slice = data.slice(offset, offset + limit);

    container.innerHTML = slice.map(entry => `
        <div class="lb-row ${entry.rank <= 3 ? 'top-rank' : ''}">
            <div class="lb-rank ${entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : ''}">#${entry.rank}</div>
            <div class="lb-user">
                <div class="lb-avatar" style="background: ${entry.avatarColor};">${entry.initials}</div>
                <span class="lb-name">${entry.name}</span>
            </div>
            <div class="lb-points">${entry.points.toLocaleString()}</div>
            <div><span class="lb-badge ${entry.badge.toLowerCase()}">${entry.badge}</span></div>
        </div>
    `).join('');
}

// Check referral limit
function checkReferralLimit() {
    const count = userData?.referralCount || 0;
    if (count >= 100) {
        showNotification('Limit Reached', 'You have reached the maximum of 100 referrals.', 'error');
        return false;
    }
    return true;
}

// Add referral
function addReferral() {
    if (!checkReferralLimit()) return false;

    userData.referralCount = (userData.referralCount || 0) + 1;
    userData.referrals = (userData.referrals || 0) + 1;
    addPoints(50, 'Friend Referral');
    saveLocalData();
    return true;
}

// Sign Up with Email/Password
async function signUpWithEmail(email, password, displayName) {
    try {
        if (!auth) throw new Error('Firebase not initialized');
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: displayName });

        // Create user document
        const userDoc = {
            uid: userCredential.user.uid,
            email: email,
            displayName: displayName,
            points: 0,
            tasksCompleted: 0,
            referrals: 0,
            videosWatched: 0,
            referralCount: 0,
            referralCode: generateReferralCode(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastCheckin: null,
            youtubeVerified: false,
            newsletterSubscribed: false,
            watchedVideos: [],
            redeemedPrizes: []
        };

        await db.collection('users').doc(userCredential.user.uid).set(userDoc);

        showNotification('Welcome!', 'Account created successfully!', 'success');
        return true;
    } catch (error) {
        showNotification('Error', error.message, 'error');
        return false;
    }
}

// Sign In with Email/Password
async function signInWithEmail(email, password) {
    try {
        if (!auth) throw new Error('Firebase not initialized');
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Welcome Back!', 'Signed in successfully!', 'success');
        return true;
    } catch (error) {
        showNotification('Error', error.message, 'error');
        return false;
    }
}

// Sign In with Google
async function signInWithGoogle() {
    try {
        if (!auth) throw new Error('Firebase not initialized');
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);

        // Check if new user
        const userDoc = await db.collection('users').doc(result.user.uid).get();
        if (!userDoc.exists) {
            const newUser = {
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName || 'User',
                photoURL: result.user.photoURL || '',
                points: 0,
                tasksCompleted: 0,
                referrals: 0,
                videosWatched: 0,
                referralCount: 0,
                referralCode: generateReferralCode(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastCheckin: null,
                youtubeVerified: false,
                newsletterSubscribed: false,
                watchedVideos: [],
                redeemedPrizes: []
            };
            await db.collection('users').doc(result.user.uid).set(newUser);
        }

        showNotification('Welcome!', 'Signed in with Google successfully!', 'success');
        return true;
    } catch (error) {
        showNotification('Error', error.message, 'error');
        return false;
    }
}

// Sign Out
async function signOut() {
    try {
        if (auth) {
            await auth.signOut();
        }
        currentUser = null;
        isLoggedIn = false;
        userData = null;
        userPoints = 1250;
        localStorage.removeItem('gg_user_data');
        showNotification('Signed Out', 'You have been signed out.', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } catch (error) {
        showNotification('Error', error.message, 'error');
    }
}

// Password reset
async function resetPassword(email) {
    try {
        if (!auth) throw new Error('Firebase not initialized');
        await auth.sendPasswordResetEmail(email);
        showNotification('Email Sent', 'Check your inbox for password reset instructions.', 'success');
        return true;
    } catch (error) {
        showNotification('Error', error.message, 'error');
        return false;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
