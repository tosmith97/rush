const Router = require('koa-router');
const passport = require('koa-passport');

module.exports = function defineRouter(models) {
  const router = new Router();

  router.get('/login', function(ctx) {
    if (ctx.isAuthenticated())
      ctx.redirect('/');
    else  
      ctx.render('login');
  });

  // Handle login requests
  router.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
  }));

  // Require authentication for all non-login endpoints
  router.use(function(ctx, next) {
    if (!ctx.isAuthenticated())
      ctx.redirect('/login');
    else
      return next();
  });

  // Rushee list view
  router.get('/', async(function*(ctx) {
    const active_id = ctx.req.user.id;
    // Get Rushee data
    const rushees = yield models.rushee.getPage(0);

    // get top rushee traits and own ratings of rushees
    const rushees_with_traits = yield Promise.all(rushees.map(async(function*(rushee) {
      const queryResults = yield Promise.join(models.rushee.getRating(rushee.id, active_id),
                                              models.rushee.getTopTraits(rushee.id));
      const topTraits = queryResults[1].map(x => x.dataValues);
      rushee.dataValues.ownRating = queryResults[0];
      rushee.dataValues.topTraits = topTraits;
      return rushee.dataValues;
    })));

    // Render view
    ctx.render('index', { rushees: rushees_with_traits });
  }));

  router.post('/rate/:rushee_id', async(function*(ctx) {
    const active = ctx.req.user;
    const rushee_id = parseInt(ctx.params.rushee_id);
    const rating = ctx.request.body.rating;
    const success = yield models.rushee.rate(rushee_id, active.id, rating);
    ctx.status = success === true ? 200 : ctx.status;
  }));

  router.get('/rushee/:rushee_id', async(function*(ctx) {
    const rushee_id = parseInt(ctx.params.rushee_id);
    const active_id = ctx.req.user.id;
    const queryResults = yield Promise.join(models.rushee.getOne(rushee_id),
                                            models.rushee.getTraits(rushee_id),
                                            models.rushee.getComments(rushee_id),
                                            models.rushee.getRating(rushee_id, active_id));
    // determine if this user already voted for the trait
    const traits = queryResults[1];
    traits.map(trait => {
      trait.voted = trait.active_ids.indexOf(active_id) !== -1;
      return trait;
    });

    const rushee = queryResults[0].dataValues;
    rushee.ownRating = queryResults[3];

    ctx.render('rushee', {
      rushee: rushee,
      traits: traits,
      comments: queryResults[2]
    });
  }));

  router.post('/summary/:rushee_id', async(function*(ctx) {
    const rushee_id = parseInt(ctx.params.rushee_id);
    const summary = ctx.request.body.summary;
    const success = yield models.rushee.summarize(rushee_id, summary);
    ctx.status = success === true ? 200 : ctx.status;
  }));

  /**
   * Add a trait for this rushee
   * @param {[type]} ctx)          {    const active_id [description]
   * @yield {[type]} [description]
   */
  router.post('/rushee/:rushee_id/new-trait/:trait_name', async(function*(ctx) {
    const active_id = ctx.req.user.id;
    const rushee_id = parseInt(ctx.params.rushee_id);
    const trait_name = ctx.params.trait_name;

    const success = yield models.rushee.add_trait(rushee_id, active_id, trait_name);
    ctx.status = success === true ? 200 : ctx.status;
  }));

  /**
   * Upvote a trait that this rushee already has
   * @param {[type]} ctx)          {    const active_id [description]
   * @yield {[type]} [description]
   */
  router.post('/rushee/:rushee_id/trait/:trait_name', async(function*(ctx) {
    const active_id = ctx.req.user.id;
    const rushee_id = parseInt(ctx.params.rushee_id);
    const trait_name = ctx.params.trait_name;
    const vote = ctx.request.body.vote === 'true';

    const success = yield models.rushee.vote_trait(rushee_id, active_id, trait_name, vote);
    ctx.status = success === true ? 200 : ctx.status;
  }));

  router.post('/rushee/:rushee_id/comment', async(function*(ctx) {
    const rushee_id = parseInt(ctx.params.rushee_id);
    const active_id = ctx.req.user.id;
    const comment = ctx.request.body.comment;
    const success = yield models.rushee.comment(rushee_id, active_id, comment);
    ctx.status = success === true ? 200 : ctx.status;
  }));

  return router;
};
