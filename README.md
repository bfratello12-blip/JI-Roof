# JI Roofing website

This is a static website that can be deployed to Vercel without a build step.

## Form setup

The homepage and contact forms send submissions to
`jiservicesconstruction@gmail.com` through [FormSubmit](https://formsubmit.co/).
FormSubmit retains submissions for up to 30 days.

After deploying the site, submit a test request from each form on the live
domain. If FormSubmit sends an activation email, open it in
`jiservicesconstruction@gmail.com` and follow the confirmation link. Check
the spam folder if necessary. FormSubmit may require activation for each form
or domain.

A request made before activation may display an error while it is awaiting
confirmation. After activating, submit each form again and confirm that both
emails arrive. Repeat this check if the website domain or recipient changes.
Form submissions must be tested through a web server, not by opening the HTML
files directly. If JavaScript is unavailable, the forms submit directly to
FormSubmit, which may display its own verification and confirmation pages.

## Tests

Run `node --test` with Node.js 18 or newer.
