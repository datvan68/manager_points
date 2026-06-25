# MongoDB Safety and Data Backup Guidelines (Production)

This document provides instructions on data storage locations, critical safety warnings, and backup/restore procedures for the MongoDB database in the Production environment.

---

## 1. Data Storage Location

MongoDB data is configured for persistent storage via a Docker Volume to prevent data loss when the container is restarted or removed.

*   **In-Container:** Data is stored in the `/data/db` directory.
*   **Docker Volume:** Mounted to a volume named `mongo-data`.
*   **Physical Path on Host (Linux Rootful):**
    Usually, Docker stores volume data in the default directory:
    ```bash
    /var/lib/docker/volumes/<compose-project-name>_mongo-data/_data
    ```
    *Where `<compose-project-name>` is the name of the directory containing the project or the project name defined via environment variables.*

> [!TIP]
> To determine the exact physical path on the host for the volume, run the following command on the VPS:
> ```bash
> docker volume inspect manager-point_mongo-data
> ```
> *(Replace `manager-point_mongo-data` with the exact volume name shown in `docker volume ls`)*

---

## 2. Critical Safety Warning (Extremely Important)

> [!CAUTION]
> **NEVER RUN THE FOLLOWING COMMAND IN THE PRODUCTION ENVIRONMENT:**
> ```bash
> docker compose down -v
> # or
> docker-compose down -v
> ```
> The `-v` (or `--volumes`) flag will **permanently delete** all volumes defined in the `docker-compose.prod.yml` file, including `mongo-data` which contains the entire database, as well as other data volumes. This action is irreversible unless an external backup exists.

---

## 3. Network Security Validation

The system is designed following the Principle of Least Privilege:
*   **No exposed ports:** The `mongodb` service configuration in the `docker-compose.prod.yml` file does not declare any `ports` (e.g., `27017:27017`) exposing it to the host.
*   **Internal Communication:** MongoDB only connects to internal services (such as `backend`) via a private Docker network named `internal` (`internal: true`).
*   **Effectiveness:** Port 27017 is completely blocked and inaccessible from the internet or outside the VPS, preventing port-scanning and direct brute-force attacks on the database.

---

## 4. Backup & Restore Guidelines

To ensure data integrity and security, perform regular backups using the `mongodump` tool built into the container.

### 4.1. Backup Procedure

#### 4.1.1. Automatic/UI Backups
Backups triggered from the System Admin UI run directly within the `backend` container. For these backups to create a standard MongoDB archive, the `mongodb-tools` package must be installed in the backend image.
You can verify the tools are installed by running:
```bash
docker compose -f docker-compose.prod.yml exec backend mongodump --version
docker compose -f docker-compose.prod.yml exec backend mongorestore --version
```
If the tools are missing, the system will gracefully fall back to a custom NDJSON format, but standard archives are recommended.

#### 4.1.2. Manual Backups (CLI)
Use the `mongodump` command directly inside the `mongodb` container to create a compressed backup in `.archive` format:

```bash
docker compose -f docker-compose.prod.yml exec mongodb mongodump --archive --db=manager-point > backup_$(date +%F).archive
```

> [!IMPORTANT]
> **Notes before and after backup:**
> 1. **Check Disk Space:** Before running the backup command, always use the `df -h` command to ensure the VPS has at least enough free space equivalent to the current database size. This prevents the disk from reaching 100% capacity, which can lead to service hangs.
> 2. **Offsite Backup:** Once created on the VPS, the backup file should be downloaded or automatically synchronized to an external storage system (e.g., Google Drive, AWS S3, separate FTP backup server, or a company local server). Never store backups exclusively on the same VPS running the production environment.

### 4.2. Restore Procedure

When you need to restore data from a backed-up archive file, run the `mongorestore` command to stream the data directly from the host file into the container:

```bash
docker compose -f docker-compose.prod.yml exec -T mongodb mongorestore --archive < backup_file.archive
```

*Note: The `-T` flag in the command above is crucial as it disables Docker Compose's TTY allocation, allowing the input data stream to be accurately piped from the host into the container.*
