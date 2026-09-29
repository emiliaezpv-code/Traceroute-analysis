# Traceroute analysis

https://emiliaezpv-code.github.io/Traceroute-analysis/

An interactive 3D globe of traceroute results. Drag to spin, scroll to zoom, hover a point to see its hop, click a line to read the notes for that path.

Visitors can paste their own traceroute at the bottom of the page. It is saved to a Firebase Realtime Database and drawn on the globe for everyone, live, along with the routers it shares with the other routes.

## Files

- `traces.js`: my own traces (edit this to add more)
- `shared.js`: the "Add your route" form: parses pasted traceroute text, saves it to Firebase, and listens for everyone else's
- `app.js`: draws the globe
- `index.html`: the page

## Firebase setup

1. Go to https://console.firebase.google.com and add a project.
2. Open **Build → Realtime Database → Create database** and start in **locked mode**.
3. In the database's **Rules** tab, paste the rules below and click **Publish**.
4. Open **Project settings → Your apps → Web (`</>`)** and register an app. Copy its `firebaseConfig` over the placeholder at the top of `shared.js`, and check that it includes `databaseURL`.

Until step 4, the page runs in demo mode: the form works, but routes only stay in the open tab.

### Rules

These rules let anyone read the routes and add new ones, but nobody can edit or delete an existing route. They also reject oversized or malformed data. You can still delete routes yourself from the Firebase console.

```json
{
  "rules": {
    "routes": {
      ".read": true,
      ".indexOn": ["createdAt"],
      "$id": {
        ".write": "!data.exists() && newData.exists()",
        ".validate": "newData.hasChildren(['name', 'target', 'hops', 'createdAt'])",
        "name":     { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40" },
        "target":   { ".validate": "newData.isString() && newData.val().length <= 200" },
        "finalRtt": { ".validate": "newData.isString() && newData.val().length <= 20" },
        "note":     { ".validate": "newData.isString() && newData.val().length <= 600" },
        "createdAt":{ ".validate": "newData.val() === now" },
        "hops": {
          "$i": {
            ".validate": "$i.length <= 2 && newData.hasChildren(['n', 'seen', 'likely'])",
            "n":      { ".validate": "newData.isNumber()" },
            "seen":   { ".validate": "newData.isString() && newData.val().length <= 200" },
            "likely": { ".validate": "newData.isString() && newData.val().length <= 200" },
            "at":     { ".validate": "newData.isString() && newData.val().length <= 12" },
            "$other": { ".validate": false }
          }
        },
        "$other": { ".validate": false }
      }
    }
  }
}
```

(`$i.length <= 2` caps a route at 100 hops, since the keys are "0" to "99".)

The `apiKey` in `firebaseConfig` is not a secret. It is meant to appear in web pages, and the rules above are what protect the data.
