FROM maven:3.9-eclipse-temurin-11 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests -q

FROM eclipse-temurin:11-jre
WORKDIR /app
COPY --from=build /app/target/quickstart-1.0-SNAPSHOT.jar app.jar
COPY config.yml config.yml
EXPOSE 8000
# Size the heap to the container (small Render/Fly instances) instead of the host
CMD ["java", "-XX:MaxRAMPercentage=75", "-XX:+UseSerialGC", "-jar", "app.jar", "server", "config.yml"]
