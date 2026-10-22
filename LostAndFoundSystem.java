import java.util.ArrayList;
import java.util.Scanner;

// Manages all lost and found items and does the matching.
public class LostAndFoundSystem implements java.io.Serializable {
    private static final long serialVersionUID = 1L;
    private ArrayList<LostItem> lostItems = new ArrayList<>();
    private ArrayList<FoundItem> foundItems = new ArrayList<>();

    public void addLostItem(LostItem item) {
        lostItems.add(item);
    }

    public void addFoundItem(FoundItem item) {
        foundItems.add(item);
    }

    // These methods let the web adapter reuse the same ArrayLists and matching logic.
    public int getLostId(LostItem item) { return lostItems.indexOf(item) + 1; }

    public LostItem getLostItem(int id) {
        return id > 0 && id <= lostItems.size() ? lostItems.get(id - 1) : null;
    }

    public FoundItem getFoundItem(int id) {
        for (FoundItem item : foundItems) if (item.getId() == id) return item;
        return null;
    }

    public ArrayList<FoundItem> getFoundItemsOf(Student student) {
        ArrayList<FoundItem> mine = new ArrayList<>();
        for (FoundItem item : foundItems)
            if (item.getReportedBy().getStudentId().equals(student.getStudentId())) mine.add(item);
        return mine;
    }

    // Method Overloading (Compile-time Polymorphism):
    // 1. Default threshold (50%)
    public ArrayList<FoundItem> getMatchingItems(LostItem lost) {
        return getMatchingItems(lost, 50);
    }

    // 2. Overloaded method with custom minimum score parameter
    public ArrayList<FoundItem> getMatchingItems(LostItem lost, int minScore) {
        ArrayList<FoundItem> matches = new ArrayList<>();
        for (FoundItem found : foundItems)
            if (!found.isClaimed() && calculateMatchScore(lost, found) >= minScore) matches.add(found);
        return matches;
    }

    public ArrayList<LostItem> getAllLostItems() { return lostItems; }
    public ArrayList<FoundItem> getAllFoundItems() { return foundItems; }

    public boolean removeLostItem(int id) {
        if (id > 0 && id <= lostItems.size()) {
            lostItems.remove(id - 1);
            return true;
        }
        return false;
    }

    public boolean removeFoundItem(int id) {
        return foundItems.removeIf(f -> f.getId() == id);
    }

    // The next ID for a found item (1, 2, 3, ...).
    public int nextFoundId() {
        return foundItems.size() + 1;
    }

    public void viewLostItems() {
        System.out.println("\nLost Items:");
        if (lostItems.isEmpty()) {
            System.out.println("Nothing reported yet.");
            return;
        }
        for (int i = 0; i < lostItems.size(); i++) {
            System.out.print((i + 1) + ". ");
            lostItems.get(i).displayItem();
        }
    }

    public void viewFoundItems() {
        System.out.println("\nFound Items:");
        if (foundItems.isEmpty()) {
            System.out.println("Nothing reported yet.");
            return;
        }
        for (FoundItem f : foundItems) {
            f.displayItem();
        }
    }

    // Only the logged-in student's own lost items.
    public ArrayList<LostItem> getLostItemsOf(Student s) {
        ArrayList<LostItem> mine = new ArrayList<>();
        for (LostItem l : lostItems) {
            if (l.getReportedBy().getStudentId().equals(s.getStudentId())) {
                mine.add(l);
            }
        }
        return mine;
    }

    // Name = 40, Category = 20, Location = 20, Date = 20 (max 100)
    public int calculateMatchScore(LostItem lost, FoundItem found) {
        int score = 0;
        if (lost.getName().equalsIgnoreCase(found.getName()))         score += 40;
        if (lost.getCategory().equalsIgnoreCase(found.getCategory())) score += 20;
        if (lost.getLocation().equalsIgnoreCase(found.getLocation())) score += 20;
        if (lost.getDateLost().equals(found.getDateFound()))          score += 20;
        return score;
    }

    // Compare one lost item with every unclaimed found item.
    public void findMatches(LostItem lost) {
        boolean anyMatch = false;
        System.out.println("\nPossible matches for your " + lost.getName() + ":");
        for (FoundItem f : foundItems) {
            if (f.isClaimed()) continue;               // skip claimed items
            int score = calculateMatchScore(lost, f);
            if (score >= 50) {                         // threshold
                anyMatch = true;
                System.out.println("\nPossible Match Found!");
                System.out.println("Item ID: " + f.getId());
                System.out.println("Item: " + f.getName());
                System.out.println("Location: " + f.getLocation());
                System.out.println("Date Found: " + f.getDateFound());
                System.out.println("Details: " + f.getDescription());
                System.out.println("Match Score: " + score + "%");
                System.out.println("Contact: hidden (use Claim Item to verify)");
            }
        }
        if (!anyMatch) {
            System.out.println("No possible matches found.");
        }
    }

    // Claim = check ID, check not already claimed, verify, reveal contact.
    public void claimItem(int id, Scanner sc) {
        FoundItem target = null;
        for (FoundItem f : foundItems) {
            if (f.getId() == id) {
                target = f;
                break;
            }
        }
        if (target == null) {
            System.out.println("No found item with that ID.");
            return;
        }
        if (target.isClaimed()) {
            System.out.println("This item has already been claimed.");
            return;
        }
        System.out.println("Prove it's yours: describe a mark or what's inside it.");
        String proof = sc.nextLine().trim();
        if (proof.length() < 5) {
            System.out.println("Not enough detail. Claim cancelled.");
            return;
        }
        target.setClaimed(true);
        System.out.println("Item claimed successfully.");
        System.out.println("Contact the finder: " + target.getContactNumber());
    }
}
