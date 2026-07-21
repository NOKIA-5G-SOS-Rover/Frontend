Am decis sa cream frontend-ul folosind react, facand la inceput o simpla aplicatie care afiseaza "Hello, World!" pe care dupa am incadrat-o intr-un container de docker

Dupa ce ne-am decis pentru design-ul site-ului, am folosit elemente de react si am creat un frontend cu mai multe functionalitati(sunt descrise mai bine in fisierul ui-ux-draft.md din folder-ul docs

## CI/CD (GitHub Actions)

Acest repository utilizeaza GitHub Actions pentru a automatiza publicarea aplicatiei. Workflow-ul este configurat in fisierul `.github/workflows/docker-deploy.yml`.

### Cand se declanseaza?
Procesul ruleaza **automat** la fiecare `push` sau la acceptarea unui `pull_request` pe branch-ul `main`. Nu este necesara nicio interventie manuala pentru build.

### Cum functioneaza?
1. **Checkout:** Se descarca cea mai recenta versiune a codului.
2. **Autentificare:** Runner-ul GitHub se conecteaza la GitHub Container Registry (GHCR) folosind un token temporar si sigur.
3. **Build:** Se construieste imaginea Docker folosind instructiunile din `Dockerfile` si setarile Nginx.
4. **Publish:** Noua imagine este etichetata cu `latest` si urcata public/privat la nivelul organizatiei.

### Accesarea imaginii generate (Pe Server)
Odata ce workflow-ul apare cu statusul *Success* in tab-ul "Actions", imaginea actualizata poate fi trasa direct pe serverul roverului.

**Nota:** Este necesara autentificarea prealabila pe server cu un *Personal Access Token (PAT)* care are permisiunea `read:packages`.

```bash
# Se descarca ultima versiune generata de Action
docker pull ghcr.io/nokia-5g-sos-rover/rover-frontend:latest

# Se ruleaza containerul 
docker run -d -p 80:80 --name frontend-rover ghcr.io/nokia-5g-sos-rover/rover-frontend:latest