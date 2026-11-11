# Build stage
FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src

RUN mvn -B clean package -DskipTests


# Runtime stage
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar
COPY models ./models

ENV PORT=10000

EXPOSE 10000

ENTRYPOINT ["sh", "-c", "java -Djava.awt.headless=true -Dserver.port=${PORT:-10000} -jar app.jar"]
