# MTG Collection

A private, local-first catalog for a Magic: The Gathering collection. It includes a SQLite database, single-card entry, validated CSV import, duplicate consolidation, and collection search.

## Run locally

Requires Node.js 20 or newer.

```sh
npm ci
npm run lint
npm test
npm start
```

Open <http://127.0.0.1:3000>. The server binds to localhost by default and stores its database at `data/collection.sqlite`. `data/` is ignored by Git.

Copy `.env.example` to `.env` to change the port, bind address, collection namespace, or database path. Keep the default `HOST=127.0.0.1` for a personal machine. Binding to a network interface makes this app reachable to other machines and is not protected by user accounts.

## Card fields

Each record requires the card name, three-letter (or other Scryfall) set code, set name, collector number, finish (`nonfoil`, `foil`, or `etched`), condition (`NM`, `LP`, `MP`, `HP`, or `DMG`), positive integer quantity, and Scryfall UUID. Set codes are normalized to uppercase.

Records that share Scryfall ID, finish, and condition are duplicates; a new quantity is added to the existing row. This keeps quantities for distinct finishes and conditions separate. Bulk imports validate the entire file before writing anything, and any invalid row rejects the full import with row and field details. CSV is limited to 5,000 records per upload.

## CSV import

Use **Download the CSV template** in the app. Its exact header is:

```csv
name,setCode,setName,collectorNumber,finish,condition,quantity,scryfallId
```

Search matches card name, set name, set code, and collector number. The collection view loads up to 500 rows at a time and offers a **Load more cards** button for larger collections; the API uses `?page=1` for the next page.

## Data isolation

Every collection read and write is scoped to `COLLECTION_NAMESPACE_ID`. It defaults to `personal`; use a different value to create an independent collection in the same database file. The application currently has no sign-in system and is intended for local personal use only.

The schema is created with additive `CREATE TABLE/INDEX IF NOT EXISTS` statements. No existing rows are deleted or rewritten by initialization. A fresh database starts empty and is ready for manual or CSV cataloguing. The current collection data lives in the local, Git-ignored `data/collection.sqlite` file and is not included in the repository.
