# FindIt — Campus Lost & Found

A minimal mobile-friendly website connected to the existing Java OOP project. Matching runs in Java using `ArrayList`, loops and string comparisons. No AI, database, Maven, Spring or npm installation is needed.

## Run the website

Install JDK 17 or newer. In this project folder, run:

```sh
javac *.java
java WebServer
```

Open **http://localhost:8080** in a browser. Keep the terminal running; press Ctrl+C to stop. Open the URL, rather than double-clicking the HTML file, so the browser can communicate with Java.

If port 8080 is occupied, use `java WebServer 8081` and open http://localhost:8081.

The server listens only on this computer. The layout adapts to mobile widths; a phone cannot access the computer's localhost URL. Public/mobile deployment and real college authentication are separate future steps.

## Sign in

Enter a name, exactly **10 digits** for the registration number, and a valid email ending in `@muj.manipal.edu`. No password or pre-created demo account is required. To return to existing reports, use the same registration number and email. A registration number cannot be reused with a different email while the server is running.

This validates formats, **not ownership of the email or college membership**. Anyone who knows the registration number and email pair can sign in as that student. Finder approval still controls when contacts are returned, but real identity protection needs college SSO or an email OTP.

Student identities, photos, reports and ownership requests are saved locally in `data/lost-found.bin` after changes. They survive sign-out and Java restarts. Sessions are not saved: sign in again after restarting Java. The data file contains personal information and is excluded from Git. Keep it private and back it up. There are no automatically seeded items in the website.

## Demonstrate the complete flow

1. Sign in as a sample finder. Select **I found something**.
2. Upload a JPG/PNG smaller than 1 MB, select Wallet and Library, choose a date, add tags and a demonstration contact number. Submit.
3. Sign out and sign in with a different sample student ID and email.
4. Select **I lost something** and report Wallet at Library on the same date. A lost-item image is optional.
5. Java returns a 100-point match. The response contains no contact number yet.
6. Choose **Request to collect** and describe a private identifying detail. Sending proof alone does not verify ownership.
7. Sign back in as the finder. Open **My found reports** on the home screen (the link shows the pending-request count), then approve or decline the request. Approval shares the finder’s phone number with that request’s owner.
8. Sign back in as the owner, open the saved lost report and refresh matches. An approved request displays the contact number.
9. After handover, the finder selects **Confirm item handed back**. That found item no longer appears as an available match.

Separate browsers/private windows can demonstrate two students simultaneously. Tabs in the same browser normally share the login cookie. Refresh the reports/matches to see updates; there are no push notifications.

## Files

| File | Responsibility |
| --- | --- |
| `Item.java`, `LostItem.java`, `FoundItem.java`, `Student.java` | Existing OOP models; inheritance, encapsulation and method overriding |
| `LostAndFoundSystem.java` | ArrayLists, report retrieval and the shared match calculation |
| `WebServer.java` | JDK HTTP server, validation, sessions, ownership checks, uploads and request approval |
| `lost-and-found.html` | Page shell and responsive styling |
| `app.js` | Forms, tags, photo selection and calls to Java using `fetch` |
| `Main.java` | Original standalone console demonstration |
| `tests/test_web.py` | Automated HTTP integration tests using Python's standard library |

The HTTP adapter adds concepts beyond first-year OOP. The project’s core remains in the original model classes and `LostAndFoundSystem`; learn the adapter separately rather than presenting authentication code as elementary OOP.

## Matching

Matching gives 40 points for the same item name and 20 each for category, location and date. Names/category/location comparisons ignore case. Unreturned items scoring at least 50 appear in descending score order, including the student’s own found reports, labelled “Your found report.” Self-claims are disabled. Both forms accept an optional time or same-day interval (IST). Enter only the start for an exact time, or both endpoints for a range. An end earlier than the start is rejected; overnight ranges are not supported. Times are saved in Java and displayed in reports, matches and ownership review. Times, photos and tags help a person review the item; they do not affect the numerical score.

A match score is not a probability or proof of ownership. Contact permission depends on finder approval, not on score alone. There is no endpoint for browsing everyone's reports, and Java checks ownership even if someone manually changes an ID in a request.

## Checks

With the server running, use another terminal:

```sh
python3 tests/test_web.py
```

This creates disposable sample accounts/reports in server memory and checks sign-in, validation, required images, full/partial matches, report isolation, hidden contacts, approval and returns. These records are saved too. Prefer `python3 tests/test_restart.py`: it starts an isolated server on port 8091 with temporary storage, checks the two-student approval flow and restart recovery, then removes only its own test data.

Optional JavaScript syntax check (if Node is installed): `node --check app.js`.

## Console version

Run `java Main` for the original terminal demonstration. It has its own in-memory system and sample data, separate from the website. Its original length-based claim prompt is only a console demonstration; the website does not use that prompt and requires finder approval.

## Before real college use

Add verified college sign-in, HTTPS hosting, rate limits, moderation and verified session management before public deployment. Local persistent storage is implemented; the current server is accessible on this computer only. The current local classroom prototype is not an official MUJ service. Finder review reduces casual false claims but cannot guarantee a truthful claimant.

To change the allowed email domain for a demo:

```sh
COLLEGE_EMAIL_DOMAIN=example.edu java WebServer
```

After posting a found report, the website loads the latest found reports and scrolls to the saved list. Lost reports remain in the lost list; their possible matches include found reports from the same account.

## Campus locations
The report forms offer LHC, AB1, AB2, AB3, Old Mess, Football Ground, Library and Other. Other accepts a custom location.

Matching only suggests items: the owner must click Request to collect and submit an identifying detail before a request appears in the finder’s inbox. Signing out does not delete anything.
