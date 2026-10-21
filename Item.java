// Parent class: details common to both lost and found items.
public class Item implements java.io.Serializable {
    private static final long serialVersionUID = 1L;
    private String timeFrom = "";
    private String timeTo = "";

    // An empty range means the reporter does not know the time.
    public String getTimeFrom() { return timeFrom; }
    public String getTimeTo() { return timeTo; }
    public void setTimeRange(String from, String to) {
        timeFrom = from;
        timeTo = to;
    }

    private String name;
    private String category;
    private String location;
    private String description;   // tags such as "black, leather"
    private Student reportedBy;

    public Item(String name, String category, String location,
                String description, Student reportedBy) {
        this.name = name;
        this.category = category;
        this.location = location;
        this.description = description;
        this.reportedBy = reportedBy;
    }

    public String getName() { return name; }
    public String getCategory() { return category; }
    public String getLocation() { return location; }
    public String getDescription() { return description; }
    public Student getReportedBy() { return reportedBy; }

    public void setDescription(String description) { this.description = description; }

    // Common part of the display; children add their own details.
    public String getBasicInfo() {
        return name + " | " + category + " | " + location;
    }

    // Overridden in LostItem and FoundItem (polymorphism).
    public void displayItem() {
        System.out.println(getBasicInfo());
    }
}
