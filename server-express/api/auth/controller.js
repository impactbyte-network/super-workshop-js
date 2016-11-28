const passport = require('passport')
const jwt = require('jsonwebtoken')

const Account = require('../accounts/model')

const Auth = module.exports = {

  /**
   * Create a new account
   */
  signup: (req, res, next) => {
    req.checkBody('name', 'Full Name is required').notEmpty()
    req.checkBody('username', 'Username is required').notEmpty()
    req.checkBody('email', 'Email is required').notEmpty()
    req.checkBody('password', 'Password is required').notEmpty()

    // Register method by passport-local-mongoose
    Account.register(new Account({
      name: req.body.name,
      username: req.body.username,
      email: req.body.email
    }), req.body.password,
    (err, account) => {
      if (err) res.json({ error: err.message })
      if (!account) res.json({ success: false, message: 'Sign up failed.' })

      // Automatically sign in after successful sign up
      Auth.signin(req, res, next)
    })
  },

  /**
   * Sign in a signed up account
   */
  signin: (req, res, next) => {
    req.checkBody('username', 'Username is required').notEmpty()
    req.checkBody('password', 'Password is required').notEmpty()

    // Authenticate method by Passport
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err)
      if (!user) return res.status(401).json({ status: 'error', code: 'Sign in failed because user is not found.' })

      const content = {
        payload: { // or claims
          iss: process.env.URL,    // ISSUER: URL of the service
          sub: user._id,           // SUBJECT: OID/UID of the user in system
          id: user.accountId,      // ACCOUNTID: Sequential ID of the user
          scope: 'self, profile',  // SCOPE: Choose specific payload/claims
          username: user.username, // USERNAME: Lowercased username of the user
          name: user.name          // NAME: Full name of the user
        },
        secret: process.env.SECRET,
        options: {
          expiresIn: '1d'
        }
      }

      return res.status(200).json({
        token: jwt.sign(content.payload, content.secret, content.options)
      })
    })(req, res, next)
  },

  /**
   * Sign out
   */
  signout: (req, res) => {
    req.logout()
    res.status(200).json({ message: 'Sign out succeded' })
  },

  /**
   * Check whether the username is already signed up
   */
  isAccountExist: (req, res, next) => {
    Account.count({
      username: req.body.username
    }, (err, count) => {
      if (err) return res.json({ success: false, message: 'Failed to check Account existency.' })
      else if (count === 0) return next()
      else return res.json({ 'message': `Account with username ${req.body.username} is already exist.` })
    })
  },

  /**
   * Check whether the user is authenticated
   */
  isAuthenticated: (req, res, next) => {
    // Check for token from various ways
    let token = req.body.token || req.query.token || req.headers.authorization.split(' ')[1] || 0

    // There's a token coming in!
    console.log({token})

    // Decode the token if it's available
    if (token !== 0) {
      // Verifies JWT token with provided secret and checks expiration
      jwt.verify(token, process.env.SECRET, (err, decoded) => {
        // If there is an error when verifying the token...
        if (err) {
          return res.status(401).json({
            s: false,
            m: 'Failed to authenticate token.',
            e: err
          })
        }
        // If everything is good, save to request for use in other routes
        req.decoded = decoded
        // Find the account based on the token subject
        Account.findById(decoded.sub, (err, account) => {
          // If there is no associated acccount...
          if (err || !account) {
            return res.status(403).send({
              s: false,
              m: 'No account is associated with that token.',
              e: err
            })
          }
          // There's the account!
          // Finally sure that actual user is authenticated with valid token
          console.log({account})
          return next()
        })
      })
    } else {
      // When there's no token
      return res.status(403).send({
        s: false,
        m: 'Sorry, no access without token.'
      })
    }
    // Finish token checker for authentication
  }

  // api.auth.js
}
