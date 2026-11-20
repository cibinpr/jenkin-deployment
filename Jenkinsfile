pipeline {
    agent any

    environment {
        NODE_VERSION       = '22'
        EC2_HOST           = credentials('mypanel-ec2-host')        // e.g. 54.x.x.x or domain
        DEPLOY_USER        = 'deploy'
        SSH_KEY_CREDENTIAL = 'mypanel-ec2-ssh-key'                  // SSH Private Key ID in Jenkins Credentials
        APP_DIR            = '/opt/mypanel'
        HEALTH_CHECK_URL   = 'http://127.0.0.1:8080/'
        HTTPS_CHECK_PORT   = '8443'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '15', artifactNumToKeepStr: '5'))
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Checking out MyPanel source code from GitHub..."
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    echo "Deploying commit: ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        stage('Dependency Installation') {
            steps {
                echo "Installing npm dependencies reproducibly..."
                // Ensures Node 22+ runtime is used and dependencies installed via lockfile
                sh '''
                    node --version
                    npm --version
                    npm ci
                '''
            }
        }

        stage('Automated Tests') {
            steps {
                echo "Running unit tests (helper validation, path-jail, auth)..."
                sh 'npm test'
            }
        }

        stage('Type Checking') {
            steps {
                echo "Validating TypeScript types across all packages..."
                sh 'npm run typecheck'
            }
        }

        stage('Build Application') {
            steps {
                echo "Building helper daemon, Fastify API, and React frontend..."
                sh 'npm run build'
            }
        }

        stage('Release Packaging') {
            steps {
                echo "Packaging release artifact for deployment..."
                sh '''
                    mkdir -p release-pkg
                    tar -czf release-pkg/release-${GIT_COMMIT_SHORT}.tar.gz \
                        --exclude='.git' \
                        --exclude='node_modules' \
                        --exclude='release-pkg' \
                        --exclude='*.tar.gz' \
                        .
                '''
                archiveArtifacts artifacts: 'release-pkg/*.tar.gz', fingerprint: true
            }
        }

        stage('Pre-Deployment Backup & Verification') {
            steps {
                echo "Connecting to EC2 to perform pre-deployment backup..."
                sshagent([SSH_KEY_CREDENTIAL]) {
                    sh """
                        ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${EC2_HOST} '
                            if [ -f /opt/mypanel/deployment/backup.sh ]; then
                                echo "Running pre-deployment backup...";
                                sudo /opt/mypanel/deployment/backup.sh pre-deploy-${GIT_COMMIT_SHORT};
                            else
                                echo "First deployment or backup script not found at target. Creating backup directory...";
                                sudo mkdir -p /var/backups/mypanel;
                            fi
                        '
                    """
                }
            }
        }

        stage('Deploy to AWS EC2') {
            steps {
                echo "Deploying release ${env.GIT_COMMIT_SHORT} to AWS EC2..."
                sshagent([SSH_KEY_CREDENTIAL]) {
                    sh """
                        # Transfer release package to EC2 staging location
                        scp -o StrictHostKeyChecking=accept-new release-pkg/release-${GIT_COMMIT_SHORT}.tar.gz ${DEPLOY_USER}@${EC2_HOST}:/tmp/

                        # Execute atomic deployment script on EC2 host
                        ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${EC2_HOST} '
                            sudo /opt/mypanel/deployment/deploy.sh /tmp/release-${GIT_COMMIT_SHORT}.tar.gz ${GIT_COMMIT_SHORT}
                        '
                    """
                }
            }
        }

        stage('Post-Deployment Health Check') {
            steps {
                echo "Verifying service status and health checks..."
                sshagent([SSH_KEY_CREDENTIAL]) {
                    sh """
                        ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${EC2_HOST} '
                            echo "Checking systemd service statuses..."
                            sudo systemctl is-active --quiet panel-helper || (echo "panel-helper service is DOWN" && exit 1)
                            sudo systemctl is-active --quiet panel-api || (echo "panel-api service is DOWN" && exit 1)
                            sudo systemctl is-active --quiet nginx || (echo "nginx service is DOWN" && exit 1)

                            echo "Validating Nginx configuration..."
                            sudo nginx -t

                            echo "Checking local API endpoint..."
                            curl -fsS -I ${HEALTH_CHECK_URL} > /dev/null || (echo "API port 8080 health check failed" && exit 1)

                            echo "Deployment successfully verified for commit ${GIT_COMMIT_SHORT}!"
                        '
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded! Release ${env.GIT_COMMIT_SHORT} is live on EC2."
        }
        failure {
            echo "Pipeline failed! Initiating rollback notification..."
            script {
                try {
                        sshagent([SSH_KEY_CREDENTIAL]) {
                            sh """
                                ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${EC2_HOST} '
                                    if [ -f /opt/mypanel/deployment/rollback.sh ]; then
                                        echo "Triggering automated rollback...";
                                        sudo /opt/mypanel/deployment/rollback.sh;
                                    fi
                                '
                            """
                        }
                    } catch (Exception e) {
                        echo "Automated rollback attempt completed with error: ${e.getMessage()}"
                    }
            }
        }
        always {
            cleanWs()
        }
    }
}

