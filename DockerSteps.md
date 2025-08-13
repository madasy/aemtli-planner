# Docker Deployment Guide for Raspberry Pi

This guide outlines the steps to deploy the `aemtli-planner-starter` application from an Apple ARM development machine to a Raspberry Pi, leveraging Docker Hub for multi-architecture image management.

## Step 1: Building and Pushing Images to Docker Hub 🏗️

The first step is to build multi-architecture Docker images for your application's `web` and `api` services and push them to a Docker registry. This ensures they will run correctly on both your ARM-based laptop and the Raspberry Pi.

1.  **Navigate to your project directory**: Open your terminal and change to the `aemtli-planner-starter` folder where your `docker-compose.yml` file is located.

    ```bash
    cd /path/to/aemtli-planner-starter
    ```

2.  **Log in to Docker Hub**: You'll need to authenticate with your Docker Hub account to push your images.

    ```bash
    docker login
    ```
    Enter your Docker Hub username and password when prompted.

3.  **Build and Push Multi-Architecture Images**: Use the `docker buildx build` command to create images for both `linux/amd64` and `linux/arm64` architectures. Run the following commands for each of your services (`web` and `api`).

    * **For the `web` service**:
        ```bash
        docker buildx build --platform linux/arm64 -t madasy/aemtli-planner-web:latest --push ./web
        ```

    * **For the `api` service**:
        ```bash
        docker buildx build --platform linux/arm64 -t madasy/aemtli-planner-api:latest --push ./api
        ```

    **Command Breakdown**:
    * `--platform linux/amd64,linux/arm64`: Specifies that the images should be built for both AMD64 and ARM64 architectures.
    * `-t madasy/...:latest`: Tags the images with a repository name on Docker Hub (`madasy/aemtli-planner-web` and `madasy/aemtli-planner-api`) and the `latest` tag.
    * `--push`: Automatically pushes the built images to your Docker Hub repository.
    * `./web` or `./api`: Defines the build context, pointing to the location of the `Dockerfile` for each service.

4.  **Update `docker-compose.yml` for Deployment**:
    Modify your `docker-compose.yml` file to pull the images from Docker Hub instead of building them locally. This new configuration should be used on your Raspberry Pi.

    ```yaml
    version: "3.9"
    services:
      db:
        image: postgres:16
        restart: always
        environment:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: aemtli
        ports:
          - "5432:5432"
        volumes:
          - db_data:/var/lib/postgresql/data

      api:
        image: madasy/aemtli-planner-api:latest
        restart: always
        environment:
          DATABASE_URL: postgresql://postgres:postgres@db:5432/aemtli?schema=public
          ICS_START_TIME: ${ICS_START_TIME}
        ports:
          - "4000:4000"
        depends_on:
          - db

      web:
        image: madasy/aemtli-planner-web:latest
        restart: always
        environment:
          NEXT_PUBLIC_API_BASE: http://api:4000 
          ADMIN_USERNAMES: ${ADMIN_USERNAMES}
        ports:
          - "80:3000"
        depends_on:
          - api

    volumes:
      db_data:
    ```

## Step 2: Deploying on the Raspberry Pi 🚀

Once your images are on Docker Hub and you have the updated `docker-compose.yml` file, deploying the application is straightforward.

1.  **SSH into your Raspberry Pi**: Access the terminal of your Raspberry Pi to prepare for deployment.

    ```bash
    ssh pi@your_pi_ip_address
    ```

2.  **Install Docker and Docker Compose**: If Docker is not already installed on your Raspberry Pi, use the official convenience script.

    ```bash
    # Install Docker
    curl -fsSL [https://get.docker.com](https://get.docker.com) -o get-docker.sh
    sudo sh get-docker.sh

    # Install the Docker Compose plugin
    sudo apt-get install docker-compose-plugin

    # Add your user to the docker group
    sudo usermod -aG docker $USER

    # You must log out and log back in for the group changes to take effect.
    ```

3.  **Create the `docker-compose.yml` file manually**: Instead of transferring the file, you will create a new directory and file on the Raspberry Pi, then paste the content.

    ```bash
    # Navigate to your home directory
    cd /home/jose/
    # Create a new project folder
    mkdir aemtli-planner
    # Navigate into the new folder
    cd aemtli-planner/
    # Create the docker-compose.yml file and open it with nano
    nano docker-compose.yml
    ```
    
    * Copy the `docker-compose.yml` content from **Step 1.4**.
    * Paste the content into the `nano` editor (on most terminals, this is done with `Ctrl+Shift+V` or right-click `Paste`).
    * Save the file by pressing `Ctrl + O`, then `Enter`.
    * Exit the editor by pressing `Ctrl + X`.

4.  **Start the application**: In the `aemtli-planner` directory, run the `docker compose up` command. Docker will automatically pull the correct `linux/arm64` images from Docker Hub and start all the services.

    ```bash
    docker compose up -d
    ```
    * `up`: Starts the services defined in the `docker-compose.yml` file.
    * `-d`: Runs the containers in detached mode (in the background).

5.  **Redeploy the Containers**: In case you need to redeploy the containers to apply the new configuration

    ```bash
    cd /home/jose/aemtli-planner/
    ```
    ```bash
    docker stop $(docker ps -q)
    docker pull madasy/aemtli-planner-web:latest
    docker compose up -d --force-recreate
    ```
    * `--force-recreate`:  flag ensures that the containers are rebuilt with the new configuration, including the restart policy.
    

Your application should now be running on the Raspberry Pi! You can access the web interface by navigating to your Pi's IP address in a web browser.