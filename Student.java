// Represents the person using the system (the logged-in student).
public class Student implements java.io.Serializable {
    private static final long serialVersionUID = 1L;
    private String name;
    private String studentId;
    private String email;

    public Student(String name, String studentId, String email) {
        this.name = name;
        this.studentId = studentId;
        this.email = email;
    }

    public String getName() { return name; }
    public String getStudentId() { return studentId; }
    public String getEmail() { return email; }
}
