import java.util.ArrayList;
import java.util.Scanner;

public class Main {
    static Scanner sc = new Scanner(System.in);

    public static void main(String[] args) {
        LostAndFoundSystem system = new LostAndFoundSystem();
        addSampleData(system);

        Student user = login();

        int choice = 0;
        while (choice != 7) {
            System.out.println("\n===== FindIt — Lost & Found System =====");
            System.out.println("1. Report Lost Item");
            System.out.println("2. Report Found Item");
            System.out.println("3. View Lost Items");
            System.out.println("4. View Found Items");
            System.out.println("5. Find My Item");
            System.out.println("6. Claim Item");
            System.out.println("7. Exit");
            choice = readInt("Enter your choice: ");

            switch (choice) {
                case 1: reportLost(system, user); break;
                case 2: reportFound(system, user); break;
                case 3: system.viewLostItems(); break;
                case 4: system.viewFoundItems(); break;
                case 5: findMyItem(system, user); break;
                case 6:
                    int id = readInt("Enter found item ID: ");
                    system.claimItem(id, sc);
                    break;
                case 7: System.out.println("Goodbye, " + user.getName() + "!"); break;
                default: System.out.println("Please choose 1 to 7.");
            }
        }
    }

    // Login: only students with a valid ID and college email get in.
    static Student login() {
        while (true) {
            System.out.println("=== STUDENT LOGIN ===");
            System.out.print("Name: ");
            String name = sc.nextLine().trim();
            System.out.print("Student ID (numbers only): ");
            String id = sc.nextLine().trim();
            System.out.print("College email: ");
            String email = sc.nextLine().trim();

            boolean idOk = id.matches("\\d{4,}");
            boolean emailOk = email.contains("@") && email.contains(".");
            if (!name.isEmpty() && idOk && emailOk) {
                return new Student(name, id, email);
            }
            System.out.println("Invalid details. Try again.\n");
        }
    }

    static void reportLost(LostAndFoundSystem system, Student user) {
        System.out.print("Item name: ");
        String name = sc.nextLine().trim();
        String category = chooseCategory();
        System.out.print("Location lost: ");
        String location = sc.nextLine().trim();
        System.out.print("Date lost (dd/mm/yyyy): ");
        String date = sc.nextLine().trim();
        System.out.print("Description (tags, e.g. black, leather): ");
        String desc = sc.nextLine().trim();

        system.addLostItem(new LostItem(name, category, location, desc, user, date));
        System.out.println("Lost item reported successfully.");
    }

    static void reportFound(LostAndFoundSystem system, Student user) {
        System.out.print("Item name: ");
        String name = sc.nextLine().trim();
        String category = chooseCategory();
        System.out.print("Location found: ");
        String location = sc.nextLine().trim();
        System.out.print("Date found (dd/mm/yyyy): ");
        String date = sc.nextLine().trim();
        System.out.print("Description (tags): ");
        String desc = sc.nextLine().trim();
        System.out.print("Your phone number (kept hidden): ");
        String phone = sc.nextLine().trim();

        system.addFoundItem(new FoundItem(system.nextFoundId(), name, category,
                location, desc, user, date, phone));
        System.out.println("Found item reported successfully.");
    }

    static void findMyItem(LostAndFoundSystem system, Student user) {
        ArrayList<LostItem> mine = system.getLostItemsOf(user);
        if (mine.isEmpty()) {
            System.out.println("You have not reported any lost items yet.");
            return;
        }
        System.out.println("\nYour lost items:");
        for (int i = 0; i < mine.size(); i++) {
            System.out.print((i + 1) + ". ");
            mine.get(i).displayItem();
        }
        int pick = readInt("Which one are you looking for? ");
        if (pick < 1 || pick > mine.size()) {
            System.out.println("Invalid choice.");
            return;
        }
        system.findMatches(mine.get(pick - 1));
    }

    // Fixed category list so spelling mistakes can't break matching.
    static String chooseCategory() {
        System.out.println("Category: 1.Accessories 2.Electronics 3.Documents 4.Other");
        int c = readInt("Choose 1-4: ");
        switch (c) {
            case 1: return "Accessories";
            case 2: return "Electronics";
            case 3: return "Documents";
            default: return "Other";
        }
    }

    // Safe number input: no crash if the user types letters.
    static int readInt(String prompt) {
        System.out.print(prompt);
        try {
            return Integer.parseInt(sc.nextLine().trim());
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    // A few ready-made found items so you can test matching straight away.
    static void addSampleData(LostAndFoundSystem system) {
        Student finder = new Student("Rahul", "2001", "rahul@college.edu");
        system.addFoundItem(new FoundItem(system.nextFoundId(), "Wallet", "Accessories",
                "Library", "black, leather", finder, "07/10/2026", "98100 22341"));
        system.addFoundItem(new FoundItem(system.nextFoundId(), "Earphones", "Electronics",
                "Library", "white, case", finder, "06/10/2026", "98100 22341"));
    }
}
