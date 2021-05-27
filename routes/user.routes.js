const express = require("express");
const session = require('express-session');
const router = express.Router();

const { check, validationResult } = require('express-validator');

router.post('/save-settings',
    [
        check('name')
            .not()
            .isEmpty()
            .withMessage('Name is required'),
        check('email', 'Email is required')
            .isEmail(),
        check('password', 'Password is required')
            .isLength({ min: 1 })
            .custom((val, { req, loc, path }) => {
                if (val !== req.body.confirm_password) {
                    throw new Error("Passwords don't match");
                } else {
                    return value;
                }
            }),
    ], (req, res) => {
        var errors = validationResult(req).array();
        if (errors) {
            req.session.errors = errors;
            req.session.success = false;
            res.redirect('/settings');
        } else {
            req.session.success = true;
            res.redirect('/settings');
        }
    });

router.get('/settings', function (req, res) {
    res.render('settings', {
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
});

router.get("/", (req, res) => {
    res.render("index", { globals: globalPage }); // index refers to index.ejs
  });

module.exports = router;
