import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getDatabase, ref, set, push } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBlmfUnWBmtlqLzcrP8QOLjhGm-zo7nWOI",
    authDomain: "healthful-wsc.firebaseapp.com",
    projectId: "healthful-wsc",
    storageBucket: "healthful-wsc.appspot.com",
    messagingSenderId: "692333373900",
    appId: "1:692333373900:web:42c451627d3ba020281569",
    databaseURL: "https://healthful-wsc-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const clientId = '130095';
const clientSecret = '1cab1c47c485d4c5f65d519315953bd531ba55e7';
const redirectUri = 'https://healthful-wsc.web.app/';
const startDate = '2024-01-01T00:00:00Z';
const endDate = '2024-06-30T23:59:59Z';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    const authorizeButton = document.getElementById('authorizeButton');
    if (authorizeButton) {
        console.log('Authorize button found');
        authorizeButton.addEventListener('click', () => {
            console.log('Authorize button clicked');
            window.location.href = `http://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=activity:read_all`;
        });
    } else {
        console.error('Authorize button not found');
    }

    async function getToken(code) {
        console.log('Getting token with code:', code);
        try {
            const response = await fetch('https://www.strava.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code: code,
                    grant_type: 'authorization_code',
                    redirect_uri: redirectUri
                })
            });
            const data = await response.json();
            if (response.ok) {
                console.log('Token data received:', data);
            } else {
                console.error('Error response from token API:', data);
            }
            return data;
        } catch (error) {
            console.error('Error getting token:', error);
            throw error;
        }
    }

    async function getAthlete(accessToken) {
        console.log('Getting athlete data with access token:', accessToken);
        try {
            const response = await fetch('https://www.strava.com/api/v3/athlete', {
                headers: { 'Authorization': 'Bearer ' + accessToken }
            });
            const data = await response.json();
            if (response.ok) {
                console.log('Athlete data received:', data);
            } else {
                console.error('Error response from athlete API:', data);
            }
            return data;
        } catch (error) {
            console.error('Error getting athlete data:', error);
            throw error;
        }
    }

    async function getActivities(accessToken) {
        console.log('Getting activities with access token:', accessToken);
        try {
            const response = await fetch('https://www.strava.com/api/v3/athlete/activities?after=' + new Date(startDate).getTime() / 1000 + '&before=' + new Date(endDate).getTime() / 1000, {
                headers: { 'Authorization': 'Bearer ' + accessToken }
            });
            const data = await response.json();
            if (response.ok) {
                console.log('Activities data received:', data);
            } else {
                console.error('Error response from activities API:', data);
            }
            return data;
        } catch (error) {
            console.error('Error getting activities:', error);
            throw error;
        }
    }

    async function saveAuthorizationToRealtimeDatabase(userId, tokenData) {
        console.log('Saving authorization to Realtime Database for user:', userId, 'with token data:', tokenData);
        try {
            await set(ref(database, 'users/' + userId + '/auth/strava'), {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt: tokenData.expires_at
            });
            console.log('Authorization data saved to Realtime Database');
        } catch (error) {
            console.error('Error saving authorization to Realtime Database:', error);
        }
    }

    async function saveActivitiesToRealtimeDatabase(userId, activities) {
        console.log('Saving activities to Realtime Database for user:', userId);
        try {
            for (const activity of activities) {
                await push(ref(database, 'users/' + userId + '/activities'), {
                    type: activity.type,
                    distance: activity.distance,
                    duration: activity.moving_time,
                    start_date: activity.start_date,
                    average_heartrate: activity.average_heartrate || null,
                });
                console.log('Activity saved to Realtime Database:', activity);
            }
        } catch (error) {
            console.error('Error saving activities to Realtime Database:', error);
        }
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    function displaySummary(activities) {
        console.log('Displaying summary for activities');
        const summaryTableBody = document.querySelector('#activitySummaryTable tbody');
        const summaryTableFooter = document.querySelector('#activitySummaryTable tfoot');
        const activityTypes = {};

        let totalActivities = 0;
        let totalDistance = 0;
        let totalDuration = 0;
        let totalHeartRates = [];
        
        activities.forEach(activity => {
            const type = activity.type;
            const distance = activity.distance / 1000;
            const duration = activity.moving_time / 60;
            const heartRate = activity.average_heartrate || 0;

            if (!activityTypes[type]) {
                activityTypes[type] = {
                    count: 0,
                    totalDistance: 0,
                    totalDuration: 0,
                    heartRates: []
                };
            }

            activityTypes[type].count += 1;
            activityTypes[type].totalDistance += distance;
            activityTypes[type].totalDuration += duration;
            if (heartRate > 0) {
                activityTypes[type].heartRates.push(heartRate);
            }
        });

        for (const type in activityTypes) {
            const avgHeartRate = activityTypes[type].heartRates.length > 0
                ? (activityTypes[type].heartRates.reduce((a, b) => a + b, 0) / activityTypes[type].heartRates.length).toFixed(2)
                : 'N/A';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${type}</td>
                <td>${activityTypes[type].count}</td>
                <td>${activityTypes[type].totalDistance.toFixed(2) === '0.00' ? '-' : activityTypes[type].totalDistance.toFixed(2)}</td>
                <td>${activityTypes[type].totalDuration.toFixed(2) === '0.00' ? '-' : activityTypes[type].totalDuration.toFixed(2)}</td>
                <td>${avgHeartRate}</td>
            `;
            summaryTableBody.appendChild(row);

            totalActivities += activityTypes[type].count;
            totalDistance += activityTypes[type].totalDistance;
            totalDuration += activityTypes[type].totalDuration;
            totalHeartRates = totalHeartRates.concat(activityTypes[type].heartRates);
        }

        const avgTotalHeartRate = totalHeartRates.length > 0
            ? (totalHeartRates.reduce((a, b) => a + b, 0) / totalHeartRates.length).toFixed(2)
            : 'N/A';
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `
            <td>Total</td>
            <td>${totalActivities}</td>
            <td>${totalDistance.toFixed(2) === '0.00' ? '-' : totalDistance.toFixed(2)}</td>
            <td>${totalDuration.toFixed(2) === '0.00' ? '-' : totalDuration.toFixed(2)}</td>
            <td>${avgTotalHeartRate}</td>
        `;
        summaryTableFooter.appendChild(totalRow);
    }

    function getMonthName(month) {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return monthNames[month];
    }

    function displayHealthfulRecap(activities) {
        console.log('Displaying healthful recap');
        const healthfulRecapTableBody = document.querySelector('#healthfulRecapTable tbody');
        const healthfulRecapTableFooter = document.querySelector('#healthfulRecapTable tfoot');
        const monthlyData = {};

        let totalWalkRunDistance = 0;
        let totalRideDistance = 0;
        let totalOtherSportDuration = 0;
        let totalPoints = 0;

        activities.forEach(activity => {
            const date = new Date(activity.start_date_local);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const type = activity.type;
            const distance = activity.distance / 1000;
            const duration = activity.moving_time / 60;

            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = {
                    walkRunDistance: 0,
                    rideDistance: 0,
                    otherSportDuration: 0,
                    points: 0
                };
            }

            if (type === 'Walk' || type === 'Run') {
                monthlyData[monthYear].walkRunDistance += distance;
                monthlyData[monthYear].points += distance * 800;
            } else if (type === 'Ride') {
                monthlyData[monthYear].rideDistance += distance;
                monthlyData[monthYear].points += distance * 200;
            } else {
                monthlyData[monthYear].otherSportDuration += duration;
                monthlyData[monthYear].points += duration * 67;
            }
        });

        const sortedMonths = Object.keys(monthlyData).sort((a, b) => new Date(b) - new Date(a));

        for (const monthYear of sortedMonths) {
            const [year, month] = monthYear.split('-');
            const monthName = getMonthName(parseInt(month) - 1);
            const data = monthlyData[monthYear];
            if (data.walkRunDistance > 0 || data.rideDistance > 0 || data.otherSportDuration > 0) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${year} ${monthName}</td>
                    <td>${data.walkRunDistance.toFixed(2) === '0.00' ? '-' : data.walkRunDistance.toFixed(2)}</td>
                    <td>${data.rideDistance.toFixed(2) === '0.00' ? '-' : data.rideDistance.toFixed(2)}</td>
                    <td>${data.otherSportDuration.toFixed(2) === '0.00' ? '-' : data.otherSportDuration.toFixed(2)}</td>
                    <td>${data.points.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                `;
                healthfulRecapTableBody.appendChild(row);

                totalWalkRunDistance += data.walkRunDistance;
                totalRideDistance += data.rideDistance;
                totalOtherSportDuration += data.otherSportDuration;
                totalPoints += data.points;
            }
        }

        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `
            <td>Total</td>
            <td>${totalWalkRunDistance.toFixed(2)}</td>
            <td>${totalRideDistance.toFixed(2)}</td>
            <td>${totalOtherSportDuration.toFixed(2)}</td>
            <td>${totalPoints.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        `;
        healthfulRecapTableFooter.appendChild(totalRow);
    }

    function displayMonthlyActivities(monthYear, activities) {
        console.log('Displaying monthly activities for', monthYear);
        const tableContainer = document.getElementById('monthlyActivities');

        const [year, month] = monthYear.split('-');
        const monthName = getMonthName(parseInt(month) - 1);

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Activity Date</th>
                    <th>Sport Type</th>
                    <th>Total Distance (km)</th>
                    <th>Total Duration (minutes)</th>
                </tr>
            </thead>
            <tbody>
                ${activities.map(activity => `
                    <tr>
                        <td>${activity.date}</td>
                        <td>${activity.type}</td>
                        <td>${activity.distance === '-' ? '-' : parseFloat(activity.distance).toFixed(2)}</td>
                        <td>${parseFloat(activity.duration).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        const header = document.createElement('h3');
        header.textContent = `Period: ${monthName} ${year}`;
        tableContainer.appendChild(header);
        tableContainer.appendChild(table);
    }

    function displayActivities(activities) {
        console.log('Displaying activities');
        const monthlyActivities = {};

        activities.forEach(activity => {
            const date = new Date(activity.start_date_local);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const type = activity.type;
            const distance = activity.distance / 1000;
            const duration = activity.moving_time / 60;

            if (!monthlyActivities[monthYear]) {
                monthlyActivities[monthYear] = [];
            }

            monthlyActivities[monthYear].push({
                date: date.toISOString().split('T')[0] + ' ' + date.toISOString().split('T')[1].split('.')[0],
                type: type,
                distance: distance === 0 ? '-' : distance.toFixed(2),
                duration: duration.toFixed(2)
            });
        });

        const sortedMonths = Object.keys(monthlyActivities).sort((a, b) => new Date(b) - new Date(a));

        for (const monthYear of sortedMonths) {
            displayMonthlyActivities(monthYear, monthlyActivities[monthYear]);
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        getToken(code).then(async tokenData => {
            if (tokenData.access_token) {
                console.log('Access token obtained:', tokenData.access_token);
                document.getElementById('authorizeButton').style.display = 'none';
                document.querySelector('p').style.display = 'none';
                const user = await signInAnonymously(auth); // Authenticate the user
                await saveAuthorizationToRealtimeDatabase(user.user.uid, tokenData); // Save token data
                const athlete = await getAthlete(tokenData.access_token);
                document.getElementById('athleteName').textContent = athlete.firstname + ' ' + athlete.lastname;
                document.getElementById('athleteCity').textContent = athlete.city;
                document.getElementById('startDateDisplay').textContent = formatDate(startDate);
                document.getElementById('endDateDisplay').textContent = formatDate(endDate);
                const totalDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
                document.getElementById('totalDays').textContent = totalDays;
                const activities = await getActivities(tokenData.access_token);
                if (activities.length > 0) {
                    displaySummary(activities);
                    displayHealthfulRecap(activities);
                    displayActivities(activities);
                    await saveActivitiesToRealtimeDatabase(user.user.uid, activities); // Save activities to Realtime Database
                    document.getElementById('summary').style.display = 'block';
                    document.getElementById('healthfulRecap').style.display = 'block';
                    document.getElementById('activities').style.display = 'block';
                    document.getElementById('reportContent').classList.add('container-wide');
                } else {
                    alert('No activities found within the specified date range.');
                }
            } else {
                alert('Failed to obtain access token.');
            }
        }).catch(error => {
            console.error('Error getting token:', error);
        });
    }
});
