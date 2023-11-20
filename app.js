require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const Schema = mongoose.Schema;

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.Secret,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MongoDB, {
}).then(() => {
    console.log(`connection to database established`)
}).catch(err => {
    console.log(`db error ${err.message}`);
    process.exit(-1)
});

const userSchema = new mongoose.Schema({
    name: String,
    store_location: String,
    store_id: {
        type: String,
        unique: true,
        default: () => uuid.v4()
    },
    phone_no: Number,
    pin_code: Number,
    email: String,
    password: String
});

userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//////////////////////////////////////Client Collection/////////////////////////////////////////

const clientSchema = new Schema({
    email: String,
    name: String,
    Contact: Number,
    Joining: {
        type: Date,
        default: () => new Date().toISOString().split('T')[0]
    },
    Address: String
});

const Client = mongoose.model('Client', clientSchema);


//////////////////////////////////////Order Collections/////////////////////////////////////////

const validCategories = ["Grocerries", "Bevarages", "Fast Food", "Packed Food", "Others"];

const transactionSchema = new Schema({
    store_id: {
        type: String,
        required: true
    },
    uid: {
        type: String,
        required: true
    },
    amount: { type: Number, required: true },
    Date: {
        type: Date,
        default: () => new Date().toISOString().split('T')[0]
    },
    detail: String,
    category: {
        type: String,
        enum: validCategories,
        default: "Others"
    }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

//////////////////////////////////////Dashboard and logout/////////////////////////////////////////

app.get("/",function(req,res){
    res.send("Backend Deployment Successfull!");
})

app.get("/dashboard", function (req, res) {
    if (req.isAuthenticated()) {
        async function amount() {
            const lastMonthStartDate = new Date();
            lastMonthStartDate.setMonth(lastMonthStartDate.getMonth() - 1);
            lastMonthStartDate.setHours(0, 0, 0, 0);

            const lastMonthEndDate = new Date();
            lastMonthEndDate.setHours(23, 59, 59, 999);

            const result = await Transaction.aggregate([
                {
                    $match: {
                        Date: {
                            $gte: lastMonthStartDate,
                            $lte: lastMonthEndDate
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: "$amount" }
                    }
                }
            ]).exec();

            const clientCount = await Client.countDocuments({
                Joining: {
                    $gte: lastMonthStartDate,
                    $lte: lastMonthEndDate
                }
            }).exec();

            const totalAmount = result.length > 0 ? result[0].totalAmount : 0;
            res.write("Welcome to CRM ");
            const totalString = totalAmount.toString();
            const totalCLient = clientCount.toString();
            res.write(totalString + ' ');
            res.write(totalCLient);
            res.end();
        };

        amount();
    } else {
        res.send("Please Login Again");
    }
})

app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) {
            console.log(err);
        }
        else {
            res.send("Logout Successful");
        }
    });
});

//////////////////////////////////////Register New Admin/////////////////////////////////////////

app.post("/register", function (req, res) {
    if (req.isAuthenticated()) {

        const newUser = new User({
            name: req.body.name,
            store_location: req.body.store_location,
            phone_no: req.body.phone_no,
            pin_code: req.body.pin_code,
            username: req.body.email
        });

        User.register(newUser, req.body.password, (err, user) => {
            if (err) {
                console.log(err);
                res.send("Failed to register you");
            } else {

                passport.authenticate("local")(req, res, () => {
                    res.redirect("/dashboard");
                });
            }
        });
    } else {
        res.send("Only an authorised user can register new users!");
    }

});


//////////////////////////////////////Admin Login/////////////////////////////////////////


app.post("/login", function (req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/dashboard");
            })
        }
    });
});


//////////////////////////////////////For Clients/////////////////////////////////////////

app.route("/client")

    .get(function (req, res) {

        if (req.isAuthenticated()) {
            async function find() {
                const clients = await Client.find({}).exec();
                res.send(clients);
            }
            find();
        } else {
            res.send("Please Login Again");
        }

    })

    .post(function (req, res) {

        if (req.isAuthenticated()) {
            const newClient = new Client({
                email: req.body.email,
                name: req.body.name,
                Contact: req.body.contact,
                Address: req.body.Address
            });

            newClient.save();

            res.send("ok");
        } else {
            res.send("Please Login Again");
        }


    })

    .patch(function (req, res) {

        if (req.isAuthenticated()) {

            async function patchclient() {
                await Client.updateOne(
                    { _id: req.body.uid },
                    { $set: req.body },
                )
                res.send("sucessully patched");
            }
            patchclient();

        } else {
            res.send("Please Login Again");
        }

    })

    .delete(function (req, res) {

        if (req.isAuthenticated()) {
            async function delallClients() {
                var results = await Client.deleteOne({ uid: req.params.uid });
                res.send("deleted succesfully");
            }
            delallClients();
        } else {
            res.send("Please Login Again");
        }


    });


//////////////////////////////////////For Transactions/////////////////////////////////////////

app.route("/transaction")

    .get(function (req, res) {

        if (req.isAuthenticated()) {
            async function find() {
                var results = await Transaction.find({}).exec();
                res.send(results);
            }
            find();
        } else {
            res.send("Please Login Again");
        }

    })

    .post(function (req, res) {

        if (req.isAuthenticated()) {

            const newTransaction = new Transaction({
                store_id: req.body.storeid,
                uid: req.body.uid,
                amount: req.body.amount,
                detail: req.body.detail,
                category: req.body.category
            });

            newTransaction.save();

            res.send("ok");

        } else {
            res.send("Please Login Again");
        }

    })

    .patch(function (req, res) {

        if (req.isAuthenticated()) {
            async function updateOrder() {
                await Transaction.updateOne(
                    { _id: req.body.orderid },
                    { $set: req.body },
                )
                res.send("sucessully patched");
            }
            updateOrder();
        } else {
            res.send("Please Login Again");
        }

    })

    .delete(function (req, res) {

        if (req.isAuthenticated()) {

            async function delAllTranc() {
                var results = await Transaction.deleteOne({ Order_id: req.params.orderid });
                res.send("deleted succesfully");
            }
            delAllTranc();

        } else {
            res.send("Please Login Again");
        }

    });


app.listen(process.env.PORT || 3000, function () {
    console.log("Server started");
});