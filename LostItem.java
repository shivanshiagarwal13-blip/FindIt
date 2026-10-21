// A lost item = an Item + the date it was lost.
public class LostItem extends Item {
    private static final long serialVersionUID = 1L;
    private String dateLost;   // format dd/MM/yyyy

    public LostItem(String name, String category, String location,
                    String description, Student reportedBy, String dateLost) {
        super(name, category, location, description, reportedBy);
        this.dateLost = dateLost;
    }

    public String getDateLost() { return dateLost; }

    @Override
    public void displayItem() {
        System.out.println(getBasicInfo() + " | Lost on " + dateLost
                + " | " + getDescription());
    }
}
