// A found item = an Item + date found + claimed status + finder's contact.
public class FoundItem extends Item {
    private static final long serialVersionUID = 1L;
    private int id;
    private String dateFound;
    private boolean claimed;
    private String contactNumber;   // private: shown only after verification

    public FoundItem(int id, String name, String category, String location,
                     String description, Student reportedBy,
                     String dateFound, String contactNumber) {
        super(name, category, location, description, reportedBy);
        this.id = id;
        this.dateFound = dateFound;
        this.contactNumber = contactNumber;
        this.claimed = false;      // every new found item starts unclaimed
    }

    public int getId() { return id; }
    public String getDateFound() { return dateFound; }
    public boolean isClaimed() { return claimed; }
    public String getContactNumber() { return contactNumber; }

    public void setClaimed(boolean claimed) { this.claimed = claimed; }

    @Override
    public void displayItem() {
        String status = claimed ? "Claimed" : "Available";
        System.out.println("ID " + id + " | " + getBasicInfo() + " | Found on "
                + dateFound + " | " + getDescription() + " | " + status);
        // contactNumber is deliberately NOT printed here.
    }
}
