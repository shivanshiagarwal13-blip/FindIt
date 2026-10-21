# Lost & Found Matching System: Explanation and Viva

## Connected website version

The HTML frontend is now connected to Java. Run `javac *.java`, then `java WebServer`, and open http://localhost:8080. See `README.md` for a two-student demo and run instructions.

`app.js` sends form fields using `fetch`. `WebServer` validates them, creates the existing `LostItem` or `FoundItem` objects, and calls `LostAndFoundSystem` to store and match reports. Java returns JSON to render the result.

The website checks `@muj.manipal.edu` and requires a 10-digit registration number and uses a session cookie. No demo account or password is required. Entering an email does not verify its owner. The finder must approve an ownership request before Java includes their number in the owner's match response. Only the finder can confirm handover. Photos are saved locally with the reports; they do not affect the score.

The notes below describe the **original console version** where explicitly stated. Its length-based proof prompt is not the website's approval mechanism.

## How to run the original console version
Put all 6 `.java` files in one folder, then:
```
javac *.java
java Main
```
Login with any name, a numeric student ID (4+ digits) and an email like `a@college.edu`. Two found items are pre-loaded (a black wallet and white earphones, both at the Library) so you can test matching straight away.

## Files and what each does
| File | Job |
|---|---|
| `Student` | The logged-in person: name, studentId, email |
| `Item` | Parent class: name, category, location, description, who reported it |
| `LostItem` | Child of Item. Adds `dateLost` |
| `FoundItem` | Child of Item. Adds `id`, `dateFound`, `claimed`, `contactNumber` |
| `LostAndFoundSystem` | Holds two ArrayLists and does add / view / match / claim |
| `Main` | Login, menu loop, reading input |

## Program flow
Start, create the system, load sample data, login, show the menu, run the chosen option, back to the menu until the user picks 7.

## How the website maps to Java

| Website | Java |
|---|---|
| Sign in | `WebServer`: 10-digit registration check, email validation and session cookie |
| Save a lost report | `new LostItem(...)` then `addLostItem()` |
| Save a found report | `new FoundItem(...)` then `addFoundItem()`; required photo validated by the adapter |
| Saved reports | `getLostItemsOf(user)` / `getFoundItemsOf(user)` |
| Possible matches | Owner check, `getMatchingItems()` and `calculateMatchScore()` |
| Request ownership | Adapter stores a pending request with private identifying detail |
| Reveal contact | Finder approves; adapter includes phone only for the approved owner |
| Confirm return | Finder calls return endpoint; `setClaimed(true)` excludes the item from future matches |

## Matching logic (the core)
```
Name matches      +40
Category matches  +20
Location matches  +20
Date matches      +20
```
Show the item if the score is 50 or more and it is not already claimed. Comparisons use `equalsIgnoreCase`, so "wallet" and "Wallet" match.

## OOP concepts: where to point in the code
- **Class and object:** `new LostItem(...)`, `new FoundItem(...)`
- **Constructor:** every class. Children call `super(...)` to fill the parent's fields
- **Encapsulation:** all fields are `private`, accessed through getters and setters. `contactNumber` has only a getter, and the web adapter calls it only after checking approval
- **Inheritance:** `LostItem extends Item` and `FoundItem extends Item`, so the shared fields are written only once
- **Polymorphism (method overriding):** `displayItem()` is defined in `Item` and overridden in both children, so the same call prints different output
- **Composition ("has-a"):** every `Item` has a `Student reportedBy`
- **ArrayList:** `lostItems` and `foundItems`
- **Exception handling:** `NumberFormatException` is caught in `readInt()`, so typing letters does not crash the program

## Viva questions and answers

**1. What does your project do?**
It lets students report lost and found items. When you search for your lost item, it compares it with all found items, gives each a match score, and shows the possible matches.

**2. Why did you choose this problem?**
Lost items are common on campus, and there is no organised way for the owner to know their item was found.

**3. How does matching work? Is it AI?**
No AI. It is simple logic. Name gives 40 points, and category, location and date give 20 each. A score of 50 or more is shown as a possible match.

**4. Why a threshold of 50?**
So partial matches still show (for example a different location), while weak matches like only a date match are hidden. It can be changed in one place.

**5. Which classes did you make and why?**
Item, LostItem, FoundItem, Student, LostAndFoundSystem and Main. Each class models one real-world thing or one job.

**6. What is inheritance and where did you use it?**
A child class reuses the parent's fields and methods. LostItem and FoundItem both extend Item.

**7. Why not write name, category and location in both child classes?**
It would be repeated code. Putting them in Item means we write them once and any change is made in one place.

**8. What is encapsulation?**
Keeping fields `private` and giving access through methods. Example: `private String name;` with `getName()`.

**9. What is polymorphism? Show it.**
One method name, different behaviour. `displayItem()` prints "Lost on ..." for LostItem and the ID and Claimed status for FoundItem.

**10. Difference between overloading and overriding?**
Overloading: same method name with different parameters in the same class. Overriding: a child class redefines a parent's method with the same signature. We used overriding.

**11. What does `super` do?**
In a constructor, `super(...)` calls the parent constructor. In `displayItem()` we could use `super.displayItem()` to reuse the parent's printing.

**12. Why is `claimed` a boolean inside FoundItem and not LostItem?**
Only a found item can be claimed. It starts as `false` and becomes `true` after a successful claim.

**13. Why ArrayList and not an array?**
An ArrayList grows automatically. We don't know how many items will be reported.

**14. What happens to the data when the program closes?**
In the console version, the data is lost. The website saves the Java object graph in data/lost-found.bin, so reports and requests survive a restart. Sessions expire on restart and require signing in again.

**15. How do you stop people from claiming things that aren't theirs?**
The website sends no phone number to a requester until the finder approves their private identifying detail. The Java server checks both report ownership and approval. This reduces casual false claims but cannot guarantee ownership. College email ownership is not yet verified.

**16. Why does `findMatches` skip claimed items?**
So an item that was already handed over is not matched to someone else.

**17. What if the user types letters where a number is expected?**
`readInt()` catches `NumberFormatException` and returns -1, which the menu treats as an invalid choice.

**18. Why `equalsIgnoreCase` and not `==`?**
`==` compares memory addresses for Strings, not content. `equalsIgnoreCase` compares the text and ignores capitals.

**19. What is the difference between `String` and `ArrayList<String>`?**
A String is one piece of text. An ArrayList<String> is a resizable list of Strings.

**20. What is an abstract class? Could Item be one?**
A class that cannot be instantiated and may have abstract methods. Item could be abstract, because we never create a plain Item. We left it normal to keep it simple. To change it, write `abstract class Item` and `abstract void displayItem();`.

**21. How would you improve it?**
Verified college sign-in, notifications and better matching (for example comparing description tags). Photo uploads and the Java-connected website are already implemented.

**22. How does the website connect to the Java code?**
The browser uses fetch to send HTTP requests to WebServer. WebServer creates objects and calls LostAndFoundSystem.calculateMatchScore(), then sends JSON back. The browser displays those results.

**23. Walk me through one example.**
A reports a lost black wallet at the Library on 07/10/2026. B has reported a found wallet in the same category, at the Library, on the same date. Name 40 + category 20 + location 20 + date 20 = 100%. A submits identifying details. B approves, which lets A see B's number. After handover, B confirms the return and the item is marked claimed.

## Limitations to admit honestly
- The console compares entered date strings exactly. The website uses a date picker and Java validation with ISO dates.
- Names must be spelled the same, so "AirPods" and "Airpods" match, but "earbuds" and "earphones" don't.
- The console proof check only tests length. The website requires human finder approval, but has no verified college identity yet.
- The console has no persistence. The website uses a local data file; shared hosting and verified identity are still future work.

## Time and visibility update
`Item` now stores `timeFrom` and `timeTo`, shared by both subclasses. Java validates optional exact times and same-day intervals. These help manual comparison without changing the 100-point scoring rule. Same-student found items are now visible in matches but cannot be self-claimed.

## Returning students and request approval
The home screen links to My found reports with a pending-request count. Owners explicitly send a request after seeing a match. The finder signs back in using the same registration/email pair, reviews the private description and approves. WebServer saves the system, students, photos and ownership requests together after changes, and loads them at startup. Sessions are intentionally not persisted.
