FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY . .
RUN javac *.java
EXPOSE 8080
CMD ["java", "WebServer"]
