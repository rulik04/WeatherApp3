const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');

router.get('/', (req, res) => {
    // if (req.session.user) {
    //     res.redirect('/main');
    // }else{
    //     res.redirect('/login');
    // }

    res.redirect('/main');
});

router.get('/login', (req, res) => {
    res.render('login', { message: false });
});

// router.post('/login', async (req, res) => {
//     const { username, password } = req.body;
//     // Implement login logic using MongoDB queries
// });

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    
    // const user = await User.findOne({ username });
    const user = await User.db.collection('users').findOne({ username });

    if (!user) {
        return res.status(400).send({ message: 'Пользователь не найден' });
    }


    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
        req.session.user = user;
        // console.log('User:', req.session.user);
        // console.log('Session:', req.session);
    }
    if (!isMatch) {
        return res.status(400).send({ message: 'Неверный пароль' });
    }
    if (req.session.user.role === 'admin') {
        res.redirect('/admin');
    } else {
        res.redirect('/main');
    }
    // res.send({ message: 'Успешный вход' });
});

router.get('/signup', (req, res) => {
    res.render('signup');
});

router.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });

    if (existingUser) {
        return res.status(400).send({ message: 'Пользователь с таким именем уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ username, password: hashedPassword });

    await user.save();

    // res.send({ message: true });
    // res.redirect('/login');
    
    res.render('login', { message: true});
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {

        res.send({ message: 'Необходимо войти' });
    }
};

// router.get('/main', (req, res) => {
//     // console.log("667");
//     // console.log(req.session.user.history);
//     console.log(req.session.user);
//     if (!req.session.user) {
//         res.render('mainPage', { user: false });
//     }else{
        
//         // const userid = req.session.user._id;
//         // User.db.collection('weather').find({ username: userid }).toArray((err, result) => {
//         //     if (err) throw err;
//         //     console.log(result);
//         //     res.render('mainPage', { user: req.session.user, history: result });
//         // });

//         const userid = req.session.user._id;
//         let his = User.db.collection('weather').find({ username: ObjectId(userid) }).toArray();
//         console.log(his);
//         res.render('mainPage', { user: req.session.user });

//         res.render('mainPage', { user: req.session.user });
//     }
    //65c49aee175813b1ec130a9e
    //65c5b4f6de3507e214cfcff0
//     // res.render('mainPage', { user: req.session.user });
    
// });


router.get('/main', async (req, res) => {
    // console.log(req.session.user);
    if (!req.session.user) {
        // console.log("667");
        res.render('mainPage', { user: "noLogin" });
    } else {
        try {
            const userid = req.session.user._id;
            let his = await User.db.collection('weather').find({ username: userid }).toArray();
            
            // console.log(his);
            res.render('mainPage', { user: his, username: req.session.user });
        } catch (error) {
            console.error('Error fetching history:', error);
            res.status(500).send('Internal Server Error');
        }
    }
});

router.post('/weather', isAuthenticated, async (req, res) => {
    const { city } = req.body;
    
    const apiKey = '7445e570dcfb27be27f536a55fe702f4';
    const currentWeatherUrl = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`;

    try {
        const currentWeatherResponse = await fetch(currentWeatherUrl);
        const currentWeatherData = await currentWeatherResponse.json();

        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();
        
        let lat = currentWeatherData.coord.lat;
        let lon = currentWeatherData.coord.lon;

        const airPollutionUrl = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
        const airPollutionResponse = await fetch(airPollutionUrl);
        const airPollutionData = await airPollutionResponse.json();


        const timezoneUrl = `http://api.timezonedb.com/v2.1/get-time-zone?key=KJD9DK60HXSW&format=json&by=position&lat=${lat}&lng=${lon}`
        const timezoneResponse = await fetch(timezoneUrl);
        const timezoneData = await timezoneResponse.json();


        let date = new Date();
        let day = date.getDate();
        let monthIndex = date.getMonth();
        let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let month = monthNames[monthIndex];
        let hours = date.getHours();
        let minutes = date.getMinutes();
        day = (day < 10 ? '0' : '') + day;
        hours = (hours < 10 ? '0' : '') + hours;
        minutes = (minutes < 10 ? '0' : '') + minutes;
        let formattedDate = day + ' ' + month + ' ' + hours + ':' + minutes;


        const responseData = {
            city: city,
            currentWeather: currentWeatherData,
            forecast: forecastData,
            airPollution: airPollutionData,
            timezone: timezoneData,
            timestamp: formattedDate
        };

        
        const user = req.session.user;
        user.history.push(responseData);
        User.db.collection('weather').insertOne(
            {
                username: user._id,
                city: city,
                currentWeather: currentWeatherData,
                forecast: forecastData,
                airPollution: airPollutionData,
                timezone: timezoneData,
                timestamp: formattedDate
            }
        );
        await User.findByIdAndUpdate(user._id, { history: user.history }, { new: true });
    
        //console.log(req.session.user.history); 
        // res.render('weather', { weatherData: currentWeatherData });
        const coordinates = {
            lat: currentWeatherData.coord.lat,
            lon: currentWeatherData.coord.lon
        };
        res.render('index', { weatherData: responseData, coordinates });
       
    } catch (error) {
        console.error('Error fetching weather data:', error);
        // res.render('weather', { error: 'Error fetching weather data' });
    }
});



router.get('/weather/:cardId', isAuthenticated, async (req, res) => {
    const cardId = req.params.cardId;
    const userid = req.session.user._id;

    let his = await User.db.collection('weather').find({ username: userid }).toArray();
    res.render('index', { weatherData: his[cardId] });
});


router.get('/admin', isAuthenticated, async (req, res) => {
    if (req.session.user.role === 'admin') {
        try {
            const users = await User.db.collection('users').find().toArray();
            // console.log(users);
            res.render('admin', { users: users});
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Internal Server Error');
        }
    } else {
        res.redirect('/main');
    }
});


router.post('/deleteUser/:userId', isAuthenticated, async (req, res) => {
    const userId = req.params.userId; // Get the user ID from the request parameters

    try {
        // console.log(userId);
        await User.db.collection('users').deleteOne({ _id: new ObjectId(userId)});

        res.redirect('/admin');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.post('/editUser',  isAuthenticated, async (req, res) => {
    const userId = req.body.userId;
    const updatedUsername = req.body.username;
    const updatedRole = req.body.role;

    try {
        await User.db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { username: updatedUsername, role: updatedRole } });

        res.redirect('/admin');
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).send('Internal Server Error');
    }

});




router.post('/addUser', async (req, res) => {
    const { username, password, role } = req.body; 
    console.log(username, password, role);
    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ username, password: hashedPassword, role });

        // Save the user to the database
        await newUser.save();

        // Optionally, you can perform additional operations or validations here

        // Respond with success message
        res.redirect('/admin');
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


module.exports = router;
