import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;

/** A small HTTP adapter. The OOP classes still store reports and calculate scores. */
public class WebServer {
    private LostAndFoundSystem system = new LostAndFoundSystem();
    private Map<String, Student> accounts = new HashMap<>();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private Map<Item, String> photos = new HashMap<>();
    private ArrayList<OwnershipRequest> requests = new ArrayList<>();
    private final Set<String> verifiedAccounts = Collections.synchronizedSet(new HashSet<>());
    private final String domain = System.getenv().getOrDefault("COLLEGE_EMAIL_DOMAIN", "muj.manipal.edu").toLowerCase(Locale.ROOT);
    private final String adminPasscode = System.getenv().getOrDefault("ADMIN_PASSCODE", "admin123");
    private final Path directory = Path.of("").toAbsolutePath();
    private final Path dataFile = Path.of(System.getenv().getOrDefault("LF_DATA_FILE", "data/lost-found.bin"));

    // Save the object graph together so requests retain their links to the reports.
    private static class SavedData implements Serializable {
        private static final long serialVersionUID = 1L;
        LostAndFoundSystem system;
        Map<String, Student> accounts;
        Map<Item, String> photos;
        ArrayList<OwnershipRequest> requests;
    }

    private void loadData() throws IOException {
        if (!Files.exists(dataFile)) return;
        try (ObjectInputStream input = new ObjectInputStream(Files.newInputStream(dataFile))) {
            input.setObjectInputFilter(ObjectInputFilter.Config.createFilter(
                "maxdepth=30;maxrefs=1000000;java.base/*;WebServer$SavedData;WebServer$OwnershipRequest;LostAndFoundSystem;Student;Item;LostItem;FoundItem;!*"));
            SavedData saved = (SavedData) input.readObject();
            system = saved.system; accounts = saved.accounts; photos = saved.photos; requests = saved.requests;
        } catch (ClassNotFoundException | ClassCastException e) {
            throw new IOException("Cannot load saved reports. Keep the data file for recovery.", e);
        }
    }

    private void saveData() throws IOException {
        Files.createDirectories(dataFile.toAbsolutePath().getParent());
        Path temporary = dataFile.resolveSibling(dataFile.getFileName() + ".tmp");
        SavedData saved = new SavedData();
        saved.system = system; saved.accounts = accounts; saved.photos = photos; saved.requests = requests;
        try (ObjectOutputStream output = new ObjectOutputStream(Files.newOutputStream(temporary))) {
            output.writeObject(saved);
        }
        try { Files.move(temporary, dataFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
        catch (AtomicMoveNotSupportedException e) { Files.move(temporary, dataFile, StandardCopyOption.REPLACE_EXISTING); }
    }

    private static final int MAX_BODY = 15_000_000;

    public static void main(String[] args) throws IOException {
        String envPort = System.getenv("PORT");
        int port = envPort != null && !envPort.isEmpty() ? Integer.parseInt(envPort) : (args.length == 0 ? 8080 : Integer.parseInt(args[0]));
        WebServer app = new WebServer();
        app.loadData();
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/", app::handle);
        server.start();
        System.out.println("FindIt running on port " + port);
        System.out.println("Local:   http://localhost:" + port);
        System.out.println("Network: Access using your laptop IP (e.g. http://<your-ip>:" + port + ")");
        System.out.println("Reports and requests are saved locally. Sign in again after a server restart.");
    }

    private void handle(HttpExchange x) throws IOException {
        try {
            x.getResponseHeaders().set("Cache-Control", "no-store");
            x.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
            x.getResponseHeaders().set("Referrer-Policy", "no-referrer");
            x.getResponseHeaders().set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
            String path = x.getRequestURI().getPath();
            String method = x.getRequestMethod();
            if (!path.startsWith("/api/")) {
                require(method.equals("GET"), 405, "Method not allowed.");
                String file = switch (path) { case "/", "/lost-and-found.html" -> "lost-and-found.html"; case "/app.js" -> "app.js"; default -> null; };
                require(file != null, 404, "Page not found.");
                byte[] body = Files.readAllBytes(directory.resolve(file));
                x.getResponseHeaders().set("Content-Type", file.endsWith("js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8");
                x.sendResponseHeaders(200, body.length);
                x.getResponseBody().write(body);
                return;
            }
            require(method.equals("GET") || method.equals("POST"), 405, "Method not allowed.");
            Map<String, String> p = parameters(x.getRequestURI().getRawQuery());
            if (method.equals("POST")) {
                // Custom header + no CORS prevents other websites from submitting cookie-authenticated forms.
                require("LostFound".equals(x.getRequestHeaders().getFirst("X-Requested-With")), 403, "Use the project website to submit this request.");
                byte[] body = x.getRequestBody().readNBytes(MAX_BODY + 1);
                require(body.length <= MAX_BODY, 413, "Photo or request is too large.");
                p = parameters(new String(body, StandardCharsets.UTF_8));
            }
            Object result = route(x, path, method, p);
            if (method.equals("POST") && !path.equals("/api/logout")) saveData();
            respond(x, 200, result);
        } catch (Problem e) {
            respond(x, e.status, Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            respond(x, 400, Map.of("error", "Invalid request. Check the entered values."));
        } catch (Exception e) {
            e.printStackTrace();
            respond(x, 500, Map.of("error", "The server could not complete the request."));
        } finally { x.close(); }
    }

    private Object route(HttpExchange x, String path, String method, Map<String, String> p) throws Exception {
        if (path.equals("/api/config") && method.equals("GET")) return Map.of("domain", domain, "adminEnabled", true, "aiEnabled", System.getenv("GEMINI_API_KEY") != null);
        if (path.equals("/api/verify-ms") && method.equals("POST")) {
            String email = field(p, "email", 160).toLowerCase(Locale.ROOT);
            require(email.endsWith("@" + domain), 400, "Please use your official @" + domain + " Microsoft account.");
            verifiedAccounts.add(email);
            return Map.of("verified", true, "email", email);
        }
        if (path.equals("/api/admin/login") && method.equals("POST")) {
            String email = field(p, "email", 160).toLowerCase(Locale.ROOT);
            String passcode = field(p, "passcode", 100);
            require(passcode.equals(adminPasscode), 401, "Invalid admin passcode.");
            require(email.contains("@") && email.endsWith("@" + domain), 400, "Use your @" + domain + " faculty/staff email.");
            Student admin = accounts.computeIfAbsent("ADMIN001", k -> new Student("Campus Administrator", "ADMIN001", email));
            String oldToken = token(x);
            if (oldToken != null) sessions.remove(oldToken);
            String token = UUID.randomUUID().toString();
            sessions.put(token, new Session(admin, true, true));
            x.getResponseHeaders().set("Set-Cookie", "LFSESSION=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800");
            Map<String, Object> data = new LinkedHashMap<>(studentData(admin));
            data.put("isAdmin", true);
            data.put("isFaculty", true);
            return data;
        }
        if (path.equals("/api/faculty/login") && method.equals("POST")) {
            String email = field(p, "email", 160).toLowerCase(Locale.ROOT);
            String facultyId = field(p, "facultyId", 40).toUpperCase(Locale.ROOT);
            String name = field(p, "name", 80);
            require(email.endsWith("@" + domain), 400, "Use your official @" + domain + " faculty email.");
            require(facultyId.matches("[A-Za-z0-9\\-_]{3,20}"), 400, "Enter a valid Faculty / Staff ID (e.g. FAC101).");
            Student faculty = accounts.computeIfAbsent(facultyId, k -> new Student(name.isEmpty() ? "Faculty Member" : name, facultyId, email));
            String oldToken = token(x);
            if (oldToken != null) sessions.remove(oldToken);
            String token = UUID.randomUUID().toString();
            sessions.put(token, new Session(faculty, false, true));
            x.getResponseHeaders().set("Set-Cookie", "LFSESSION=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800");
            Map<String, Object> data = new LinkedHashMap<>(studentData(faculty));
            data.put("isAdmin", false);
            data.put("isFaculty", true);
            return data;
        }
        if (path.equals("/api/login") && method.equals("POST")) {
            String name = field(p, "name", 80), id = field(p, "studentId", 30).trim();
            String email = field(p, "email", 160).toLowerCase(Locale.ROOT);
            String role = p.getOrDefault("role", "student");
            boolean isFacultyRole = "faculty".equalsIgnoreCase(role) || id.toUpperCase(Locale.ROOT).startsWith("FAC") || id.toUpperCase(Locale.ROOT).startsWith("STAFF");
            if (isFacultyRole) {
                require(id.matches("[A-Za-z0-9\\-_]{3,20}"), 400, "Enter a valid Faculty / Staff ID (e.g. FAC101 or 10 digits).");
            } else {
                require(id.matches("[0-9]{10}"), 400, "Enter your 10-digit registration number.");
            }
            require(email.matches("[a-z0-9]+(?:[._%+\\-][a-z0-9]+)*@" + java.util.regex.Pattern.quote(domain)), 400, "Use a valid @" + domain + " email.");
            Student student = accounts.get(id);
            if (student == null) {
                for (Student existing : accounts.values()) require(!existing.getEmail().equals(email), 409, "This email is already associated with an ID.");
                student = new Student(name, id, email);
                accounts.put(id, student);
            } else {
                require(student.getEmail().equals(email), 409, "Use the email previously entered for this ID.");
            }
            String oldToken = token(x);
            if (oldToken != null) sessions.remove(oldToken);
            String token = UUID.randomUUID().toString();
            sessions.put(token, new Session(student, false, isFacultyRole));
            x.getResponseHeaders().set("Set-Cookie", "LFSESSION=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800");
            Map<String, Object> data = new LinkedHashMap<>(studentData(student));
            data.put("isAdmin", false);
            data.put("isFaculty", isFacultyRole);
            return data;
        }
        Session activeSession = sessions.get(token(x));
        Student user = signedIn(x);
        if (path.equals("/api/me") && method.equals("GET")) {
            Map<String, Object> data = new LinkedHashMap<>(studentData(user));
            data.put("isAdmin", activeSession != null && activeSession.isAdmin);
            data.put("isFaculty", activeSession != null && (activeSession.isAdmin || activeSession.isFaculty));
            return data;
        }
        if (path.equals("/api/logout") && method.equals("POST")) {
            sessions.remove(token(x));
            x.getResponseHeaders().set("Set-Cookie", "LFSESSION=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
            return Map.of("ok", true);
        }
        if (path.equals("/api/lost") && method.equals("GET")) {
            ArrayList<Object> rows = new ArrayList<>();
            for (LostItem l : system.getLostItemsOf(user)) rows.add(lostData(l));
            return rows;
        }
        if ((path.equals("/api/lost") || path.equals("/api/found")) && method.equals("POST")) {
            String name = field(p, "name", 60), category = field(p, "category", 30), location = field(p, "location", 80);
            require(List.of("Accessories", "Electronics", "Documents", "Other").contains(category), 400, "Select a valid category.");
            String description = p.getOrDefault("description", "").trim();
            require(description.length() <= 300, 400, "Keep tags under 300 characters.");
            String date = field(p, "date", 10);
            LocalDate parsed;
            try { parsed = LocalDate.parse(date); } catch (Exception e) { throw new Problem(400, "Choose a valid date."); }
            require(!parsed.isAfter(LocalDate.now(ZoneId.of("Asia/Kolkata"))), 400, "The date cannot be in the future.");
            String from = p.getOrDefault("timeFrom", "").trim();
            String to = p.getOrDefault("timeTo", "").trim();
            require(to.isEmpty() || !from.isEmpty(), 400, "Enter the start time before the end time.");
            require(from.isEmpty() || from.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]"), 400, "Enter a valid start time.");
            require(to.isEmpty() || to.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]"), 400, "Enter a valid end time.");
            if (!from.isEmpty()) {
                if (to.isEmpty()) to = from;
                require(!LocalTime.parse(to).isBefore(LocalTime.parse(from)), 400, "End time must be after start time on the selected date.");
            }
            String photo = p.getOrDefault("photo", "");
            validatePhoto(photo, path.equals("/api/found"));
            if (path.equals("/api/lost")) {
                LostItem l = new LostItem(name, category, location, description, user, date);
                l.setTimeRange(from, to);
                system.addLostItem(l); photos.put(l, photo);
                return lostData(l);
            }
            String phone = field(p, "phone", 25);
            require(phone.matches("\\+?[0-9 ()-]{7,25}") && phone.replaceAll("\\D", "").length() >= 10 && phone.replaceAll("\\D", "").length() <= 15, 400, "Enter a phone number with 10–15 digits.");
            FoundItem f = new FoundItem(system.nextFoundId(), name, category, location, description, user, date, phone);
            f.setTimeRange(from, to);
            system.addFoundItem(f); photos.put(f, photo);
            return Map.of("id", f.getId());
        }
        if (path.equals("/api/found") && method.equals("GET")) {
            ArrayList<Object> rows = new ArrayList<>();
            for (FoundItem f : system.getFoundItemsOf(user)) {
                Map<String, Object> row = foundData(f);
                ArrayList<Object> claims = new ArrayList<>();
                for (OwnershipRequest r : requests) if (r.found == f) {
                    claims.add(Map.of("id", r.id, "name", r.lost.getReportedBy().getName(), "proof", r.proof, "status", r.status, "lost", lostData(r.lost)));
                }
                row.put("requests", claims); rows.add(row);
            }
            return rows;
        }
        if (path.equals("/api/matches") && method.equals("GET")) {
            LostItem l = ownLost(p, user);
            ArrayList<Map<String, Object>> rows = new ArrayList<>();
            for (FoundItem f : system.getMatchingItems(l)) {
                Map<String, Object> row = foundData(f);
                row.put("score", system.calculateMatchScore(l, f));
                row.put("status", f.getReportedBy().getStudentId().equals(user.getStudentId()) ? "own" : "none");
                for (OwnershipRequest r : requests) if (r.lost == l && r.found == f) {
                    row.put("status", r.status);
                    if (r.status.equals("approved")) row.put("phone", f.getContactNumber());
                }
                rows.add(row);
            }
            rows.sort((a, b) -> (int)b.get("score") - (int)a.get("score"));
            return rows;
        }
        if (path.equals("/api/requests") && method.equals("POST")) {
            LostItem l = ownLost(p, user);
            FoundItem f = system.getFoundItem(number(p, "foundId"));
            require(f != null && !f.isClaimed() && system.calculateMatchScore(l, f) >= 50 && !f.getReportedBy().getStudentId().equals(user.getStudentId()), 403, "This item is not an available match for your report.");
            for (OwnershipRequest r : requests) require(!(r.lost == l && r.found == f), 409, "You have already sent a request for this match.");
            String proof = field(p, "proof", 500);
            require(proof.length() >= 10, 400, "Describe a private detail in at least 10 characters for the finder to review.");
            requests.add(new OwnershipRequest(requests.size() + 1, l, f, proof));
            return Map.of("ok", true);
        }
        if (path.equals("/api/review") && method.equals("POST")) {
            int id = number(p, "requestId");
            OwnershipRequest r = requests.stream().filter(a -> a.id == id).findFirst().orElse(null);
            require(r != null && r.found.getReportedBy().getStudentId().equals(user.getStudentId()), 403, "Only the finder can review this request.");
            require(r.status.equals("pending") && !r.found.isClaimed(), 409, "This request has already been handled.");
            String decision = field(p, "decision", 20);
            require(decision.equals("approved") || decision.equals("rejected"), 400, "Choose approve or decline.");
            if (decision.equals("approved")) for (OwnershipRequest other : requests) require(other.found != r.found || !other.status.equals("approved"), 409, "Another request is already approved for this item.");
            r.status = decision;
            return Map.of("ok", true);
        }
        if (path.equals("/api/returned") && method.equals("POST")) {
            FoundItem f = system.getFoundItem(number(p, "foundId"));
            require(f != null && f.getReportedBy().getStudentId().equals(user.getStudentId()), 403, "Only the finder can confirm a return.");
            require(!f.isClaimed(), 409, "This item has already been returned.");
            require(requests.stream().anyMatch(r -> r.found == f && r.status.equals("approved")), 409, "Approve an ownership request first.");
            f.setClaimed(true);
            return Map.of("ok", true);
        }
        if ((path.equals("/api/admin/overview") || path.equals("/api/faculty/overview")) && method.equals("GET")) {
            Session s = session(x);
            require(s.isAdmin || s.isFaculty, 403, "Faculty & Admin portal access only.");
            ArrayList<Object> allLost = new ArrayList<>();
            for (LostItem l : system.getAllLostItems()) {
                Map<String, Object> row = lostData(l);
                row.put("reporterName", l.getReportedBy().getName());
                row.put("reporterEmail", l.getReportedBy().getEmail());
                row.put("reporterId", l.getReportedBy().getStudentId());
                allLost.add(row);
            }
            ArrayList<Object> allFound = new ArrayList<>();
            for (FoundItem f : system.getAllFoundItems()) {
                Map<String, Object> row = foundData(f);
                row.put("reporterName", f.getReportedBy().getName());
                row.put("reporterEmail", f.getReportedBy().getEmail());
                row.put("reporterId", f.getReportedBy().getStudentId());
                row.put("phone", f.getContactNumber());
                allFound.add(row);
            }
            ArrayList<Object> allRequests = new ArrayList<>();
            for (OwnershipRequest r : requests) {
                allRequests.add(Map.of(
                    "id", r.id,
                    "proof", r.proof,
                    "status", r.status,
                    "itemName", r.found.getName(),
                    "foundId", r.found.getId(),
                    "finderName", r.found.getReportedBy().getName(),
                    "finderEmail", r.found.getReportedBy().getEmail(),
                    "claimantName", r.lost.getReportedBy().getName(),
                    "claimantEmail", r.lost.getReportedBy().getEmail()
                ));
            }
            Map<String, Object> stats = Map.of(
                "totalLost", allLost.size(),
                "totalFound", allFound.size(),
                "totalReturned", allFound.stream().filter(f -> Boolean.TRUE.equals(((Map<?,?>)f).get("claimed"))).count(),
                "totalClaims", allRequests.size(),
                "totalAccounts", accounts.size()
            );
            return Map.of("stats", stats, "lost", allLost, "found", allFound, "requests", allRequests);
        }
        if (path.equals("/api/admin/delete") && method.equals("POST")) {
            Session s = session(x);
            require(s.isAdmin, 403, "Central Administrator access required to delete reports.");
            String type = field(p, "type", 10);
            int id = number(p, "id");
            if ("lost".equals(type)) system.removeLostItem(id);
            else if ("found".equals(type)) system.removeFoundItem(id);
            return Map.of("ok", true);
        }
        if ((path.equals("/api/admin/resolve") || path.equals("/api/faculty/resolve")) && method.equals("POST")) {
            Session s = session(x);
            require(s.isAdmin || s.isFaculty, 403, "Faculty & Admin portal access only.");
            FoundItem f = system.getFoundItem(number(p, "id"));
            require(f != null, 404, "Found item not found.");
            f.setClaimed(true);
            return Map.of("ok", true);
        }
        throw new Problem(404, "Endpoint not found.");
    }

    private LostItem ownLost(Map<String, String> p, Student user) {
        LostItem l = system.getLostItem(number(p, "lostId"));
        require(l != null && l.getReportedBy().getStudentId().equals(user.getStudentId()), 403, "You can only view matches for your own lost reports.");
        return l;
    }
    private Map<String, Object> itemData(Item item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", item.getName()); row.put("category", item.getCategory());
        row.put("location", item.getLocation()); row.put("description", item.getDescription());
        row.put("photo", photos.getOrDefault(item, ""));
        row.put("timeFrom", item.getTimeFrom()); row.put("timeTo", item.getTimeTo());
        return row;
    }
    private Map<String, Object> lostData(LostItem l) {
        Map<String, Object> row = itemData(l);
        row.put("id", system.getLostId(l)); row.put("date", l.getDateLost()); return row;
    }
    private Map<String, Object> foundData(FoundItem f) {
        Map<String, Object> row = itemData(f);
        row.put("id", f.getId()); row.put("date", f.getDateFound()); row.put("claimed", f.isClaimed()); return row;
    }
    private Map<String, Object> studentData(Student s) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", s.getName());
        row.put("studentId", s.getStudentId());
        row.put("email", s.getEmail());
        row.put("isVerifiedMs", verifiedAccounts.contains(s.getEmail()));
        return row;
    }
    private String token(HttpExchange x) {
        String cookies = x.getRequestHeaders().getFirst("Cookie");
        if (cookies != null) for (String c : cookies.split(";")) if (c.trim().startsWith("LFSESSION=")) return c.trim().substring(10);
        return null;
    }
    private Session session(HttpExchange x) {
        Session s = sessions.get(token(x));
        require(s != null && s.expires.isAfter(Instant.now()), 401, "Please sign in again.");
        return s;
    }
    private Student signedIn(HttpExchange x) {
        return session(x).student;
    }
    private static void validatePhoto(String value, boolean required) throws IOException {
        if (value.isEmpty()) { require(!required, 400, "A photo is required for a found item."); return; }
        require(value.startsWith("data:image/jpeg;base64,") || value.startsWith("data:image/png;base64,"), 400, "Choose a JPG or PNG photo.");
        byte[] data = Base64.getDecoder().decode(value.substring(value.indexOf(',') + 1));
        require(data.length <= 10_000_000, 413, "Choose a photo smaller than 10 MB.");
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            var readers = ImageIO.getImageReaders(input);
            require(readers.hasNext(), 400, "This file is not a readable photo.");
            var reader = readers.next();
            try {
                reader.setInput(input);
                require((long) reader.getWidth(0) * reader.getHeight(0) <= 25_000_000, 400, "Choose a smaller photo (up to 25 megapixels).");
                require(reader.read(0) != null, 400, "This photo could not be read.");
            } finally { reader.dispose(); }
        }
        verifyImageWithAI(value, data);
    }
    private static void verifyImageWithAI(String base64Value, byte[] rawBytes) {
        String apiKey = System.getenv("GEMINI_API_KEY");
        if (apiKey != null && !apiKey.trim().isEmpty()) {
            try {
                String mimeType = base64Value.startsWith("data:image/png") ? "image/png" : "image/jpeg";
                String base64Data = base64Value.substring(base64Value.indexOf(',') + 1);
                String promptText = "Analyze this image. Is this image showing an actual, physical everyday lost-or-found item (e.g. wallet, phone, laptop, charger, keys, ID card, bottle, bag, glasses, notebook, earbuds, clothing, umbrella, jewelry, watch, or document)? "
                    + "Reject if it is: completely blank or black screen, a screenshot of a chat/meme/code, an empty floor or blank wall with no item, or completely unrelated. "
                    + "Respond ONLY in this exact JSON format: {\\\"valid\\\": true, \\\"reason\\\": \\\"detected object\\\"} or {\\\"valid\\\": false, \\\"reason\\\": \\\"brief reason\\\"}";

                String jsonPayload = "{\"contents\":[{\"parts\":["
                    + "{\"text\":\"" + promptText.replace("\"", "\\\"") + "\"},"
                    + "{\"inline_data\":{\"mime_type\":\"" + mimeType + "\",\"data\":\"" + base64Data + "\"}}"
                    + "]}]}";

                HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();
                HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey.trim()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .timeout(Duration.ofSeconds(10))
                    .build();

                HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() == 200) {
                    String body = resp.body().toLowerCase(Locale.ROOT);
                    if (body.contains("\"valid\": false") || body.contains("\"valid\":false")) {
                        throw new Problem(400, "AI Verification: Please upload a clear photo of an actual physical object. Random or blank images are not allowed.");
                    }
                    return;
                }
            } catch (Problem p) {
                throw p;
            } catch (Exception e) {
                System.out.println("Gemini Vision check notice: " + e.getMessage());
            }
        }

        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(rawBytes));
            if (img != null) {
                int w = img.getWidth(), h = img.getHeight();
                require(w >= 60 && h >= 60, 400, "AI Verification: Photo is too small. Please upload a clear photo of the object.");
                long sum = 0, sumSq = 0;
                int count = 0;
                for (int x = 0; x < w; x += Math.max(1, w / 12)) {
                    for (int y = 0; y < h; y += Math.max(1, h / 12)) {
                        int rgb = img.getRGB(x, y);
                        int r = (rgb >> 16) & 0xff, g = (rgb >> 8) & 0xff, b = rgb & 0xff;
                        int bright = (r + g + b) / 3;
                        sum += bright;
                        sumSq += (long) bright * bright;
                        count++;
                    }
                }
                if (count > 0) {
                    double mean = (double) sum / count;
                    double variance = ((double) sumSq / count) - (mean * mean);
                    if (variance < 15.0) {
                        throw new Problem(400, "AI Verification: The photo appears blank or uniform. Please take a clear, well-lit photo of the actual object.");
                    }
                }
            }
        } catch (Problem p) {
            throw p;
        } catch (Exception ignored) {}
    }
    private static int number(Map<String, String> p, String key) { return Integer.parseInt(p.getOrDefault(key, "0")); }
    private static String field(Map<String, String> p, String key, int max) {
        String value = p.getOrDefault(key, "").trim();
        require(!value.isEmpty() && value.length() <= max, 400, "Check " + key + " (required; maximum " + max + " characters)."); return value;
    }
    private static Map<String, String> parameters(String text) {
        Map<String, String> p = new HashMap<>();
        if (text != null && !text.isEmpty()) for (String pair : text.split("&")) {
            String[] bits = pair.split("=", 2);
            p.put(URLDecoder.decode(bits[0], StandardCharsets.UTF_8), bits.length == 2 ? URLDecoder.decode(bits[1], StandardCharsets.UTF_8) : "");
        }
        return p;
    }
    private static void require(boolean condition, int code, String message) { if (!condition) throw new Problem(code, message); }
    private static class Problem extends RuntimeException { final int status; Problem(int status, String text) { super(text); this.status = status; } }
    private static class Session {
        final Student student;
        final boolean isAdmin;
        final boolean isFaculty;
        final Instant expires = Instant.now().plusSeconds(28800);
        Session(Student s) { this(s, false, false); }
        Session(Student s, boolean isAdmin) { this(s, isAdmin, isAdmin); }
        Session(Student s, boolean isAdmin, boolean isFaculty) { this.student = s; this.isAdmin = isAdmin; this.isFaculty = isFaculty; }
    }
    private static class OwnershipRequest implements Serializable {
        private static final long serialVersionUID = 1L;
        final int id; final LostItem lost; final FoundItem found; final String proof; String status = "pending";
        OwnershipRequest(int id, LostItem lost, FoundItem found, String proof) { this.id = id; this.lost = lost; this.found = found; this.proof = proof; }
    }
    // JSON output only: incoming data uses standard URL-encoded forms, so no JSON parser is needed.
    private static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?> map) {
            StringJoiner j = new StringJoiner(",", "{", "}");
            map.forEach((k, v) -> j.add(json(k.toString()) + ":" + json(v))); return j.toString();
        }
        if (value instanceof Iterable<?> list) { StringJoiner j = new StringJoiner(",", "[", "]"); for (Object v : list) j.add(json(v)); return j.toString(); }
        StringBuilder s = new StringBuilder("\"");
        for (char c : value.toString().toCharArray()) {
            if (c == '"' || c == '\\') s.append('\\').append(c);
            else if (c < 32) s.append(String.format("\\u%04x", (int)c));
            else s.append(c);
        }
        return s.append('"').toString();
    }
    private static void respond(HttpExchange x, int status, Object value) throws IOException {
        byte[] bytes = json(value).getBytes(StandardCharsets.UTF_8);
        x.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        x.sendResponseHeaders(status, bytes.length); x.getResponseBody().write(bytes);
    }
}
