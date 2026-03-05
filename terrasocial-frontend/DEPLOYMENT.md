# Guide de Déploiement - TERRASOCIAL PWA

Ce guide explique comment déployer le frontend TERRASOCIAL en production.

## 🎯 Prérequis

- **Serveur Web**: Apache 2.4+ ou Nginx
- **SSL/TLS**: Certificat valide (Let's Encrypt recommandé)
- **Domaine**: Domaine valide pointant vers le serveur
- **Supabase**: Compte Supabase configuré avec les bonnes clés

## 📋 Checklist de Déploiement

- [ ] Configuration Supabase complète
- [ ] Clés API Supabase obtenues
- [ ] Certificat SSL/TLS installé
- [ ] Domaine configuré et DNS résolvable
- [ ] Serveur web configuré (Apache ou Nginx)
- [ ] HTTPS activé
- [ ] Service Worker compatible
- [ ] Tests en environnement staging

## 🚀 Procédure de Déploiement

### 1. Préparation des Fichiers

```bash
# Cloner ou télécharger les fichiers
cd /path/to/deployment
wget -r https://repo.com/frontend-pwa.zip
unzip frontend-pwa.zip

# Vérifier la structure
ls -la
```

### 2. Configuration Supabase

Éditer `js/supabase-client.js`:

```javascript
class SupabaseClient {
    constructor(url, key) {
        this.url = 'https://YOUR_PROJECT_ID.supabase.co';
        this.key = 'YOUR_ANON_KEY';
        // ...
    }
}
```

**Où trouver ces valeurs:**
1. Aller à https://supabase.io
2. Projet → Settings → API
3. Copier `Project URL` et `anon public key`

### 3. Apache Deployment

#### 3.1 Copier les fichiers

```bash
sudo cp -r . /var/www/terrasocial
sudo chown -R www-data:www-data /var/www/terrasocial
sudo chmod -R 755 /var/www/terrasocial
```

#### 3.2 Créer Virtual Host

```bash
sudo nano /etc/apache2/sites-available/terrasocial.conf
```

```apache
<VirtualHost *:443>
    ServerName example.com
    ServerAlias www.example.com

    DocumentRoot /var/www/terrasocial

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/example.com/privkey.pem

    <Directory /var/www/terrasocial>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Logs
    ErrorLog ${APACHE_LOG_DIR}/terrasocial_error.log
    CustomLog ${APACHE_LOG_DIR}/terrasocial_access.log combined
</VirtualHost>

# HTTP vers HTTPS
<VirtualHost *:80>
    ServerName example.com
    ServerAlias www.example.com
    Redirect permanent / https://example.com/
</VirtualHost>
```

#### 3.3 Activer le Virtual Host

```bash
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod ssl
sudo a2enmod deflate
sudo a2ensite terrasocial
sudo apache2ctl configtest  # Vérifier la syntaxe
sudo systemctl restart apache2
```

### 4. Nginx Deployment

#### 4.1 Copier les fichiers

```bash
sudo mkdir -p /var/www/terrasocial
sudo cp -r . /var/www/terrasocial
sudo chown -R nginx:nginx /var/www/terrasocial
sudo chmod -R 755 /var/www/terrasocial
```

#### 4.2 Créer configuration server block

```bash
sudo nano /etc/nginx/sites-available/terrasocial
```

Utiliser le fichier `nginx.conf` fourni et l'adapter.

#### 4.3 Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/terrasocial /etc/nginx/sites-enabled/
sudo nginx -t  # Vérifier la syntaxe
sudo systemctl restart nginx
```

### 5. Certificat SSL/TLS

#### Avec Let's Encrypt (recommandé)

```bash
# Installer certbot
sudo apt-get install certbot python3-certbot-apache  # Pour Apache
# ou
sudo apt-get install certbot python3-certbot-nginx   # Pour Nginx

# Générer certificat
sudo certbot certonly --standalone -d example.com -d www.example.com

# Auto-renouvellement
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## 🔧 Configuration Avancée

### Compression Gzip

**Apache**: Déjà dans `.htaccess`

**Nginx**: Déjà dans `nginx.conf`

### Cache Control

**Apache**: Déjà dans `.htaccess`

**Nginx**: Déjà dans `nginx.conf`

### Security Headers

**Apache**: Déjà dans `.htaccess`

**Nginx**: Déjà dans `nginx.conf`

## 🧪 Tests Post-Déploiement

### Tests Critiques

```bash
# 1. HTTPS fonctionne
curl -I https://example.com
# Doit retourner: HTTP/2 200

# 2. Service Worker
curl https://example.com/sw.js
# Doit retourner le fichier SW

# 3. Manifest
curl https://example.com/manifest.json
# Doit retourner JSON valide

# 4. CORS Headers
curl -I -H "Origin: http://example.com" https://example.com
# Doit inclure Access-Control-Allow-Origin
```

### Tests Navigateur

1. **Accès au site**
   - [ ] https://example.com charge correctement
   - [ ] Pas d'erreurs console
   - [ ] Logo et images s'affichent

2. **PWA**
   - [ ] Service Worker enregistré (DevTools → Application)
   - [ ] Offline fonctionne (DevTools → Network → Offline)
   - [ ] Manifest valide

3. **Authentification**
   - [ ] Inscription fonctionne
   - [ ] Connexion fonctionne
   - [ ] Tokens stockés localement

4. **Données**
   - [ ] Lots se chargent
   - [ ] Recherche/filtrage fonctionne
   - [ ] Offline mode affiche données en cache

## 📊 Monitoring

### Logs

**Apache**
```bash
tail -f /var/log/apache2/terrasocial_access.log
tail -f /var/log/apache2/terrasocial_error.log
```

**Nginx**
```bash
tail -f /var/log/nginx/terrasocial_access.log
tail -f /var/log/nginx/terrasocial_error.log
```

### Performance

Utiliser:
- Google Lighthouse (DevTools)
- PageSpeed Insights
- WebPageTest

Objectifs:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 95

## 🐛 Dépannage

### Service Worker ne s'enregistre pas

```javascript
// Vérifier dans console:
navigator.serviceWorker.getRegistrations()
    .then(registrations => {
        console.log('Registrations:', registrations);
    });
```

Solutions:
- Vérifier HTTPS est activé
- Vérifier CORS headers
- Vérifier `/sw.js` est accessible

### CORS errors

Vérifier headers:
```bash
curl -I -H "Origin: http://example.com" https://example.com
```

Doit inclure:
```
Access-Control-Allow-Origin: *
```

### Authentification échouée

1. Vérifier clés Supabase dans `js/supabase-client.js`
2. Vérifier CORS dans Supabase
3. Vérifier navegateur console pour tokens

## 🔒 Sécurité en Production

### Essentiels

- [ ] HTTPS obligatoire
- [ ] CSP headers strictes
- [ ] HSTS activé
- [ ] Fichiers sensibles bloqués (.env, .htaccess, etc.)
- [ ] Authentification forte (2FA Supabase)
- [ ] Backups réguliers

### Hardening Supabase

1. **RLS (Row Level Security)**
   - Activer pour toutes les tables
   - Définir policies strictes

2. **Authentification**
   - Vérification email
   - Rate limiting
   - Captcha si besoin

3. **API Keys**
   - Rotation régulière
   - Keys séparés par environnement

## 📈 Scaling

Si trafic augmente:

1. **CDN** (CloudFlare, AWS CloudFront)
   - Cacher assets statiques
   - DDoS protection

2. **Compression**
   - Gzip déjà activé
   - Minification CSS/JS

3. **Database**
   - Supabase gère auto-scaling
   - Vérifier performance requêtes

4. **Cache**
   - Augmenter TTL cache
   - Ajouter Redis si besoin

## 🔄 Mises à Jour

### Procédure Déploiement

```bash
# 1. Backup
tar -czf backup-$(date +%Y%m%d).tar.gz /var/www/terrasocial

# 2. Télécharger nouvelles versions
cd /tmp
wget https://repo.com/frontend-pwa-new.zip
unzip frontend-pwa-new.zip

# 3. Copier fichiers (garder config locale)
cp -r new_files/* /var/www/terrasocial/
cp old_js_supabase_client.js /var/www/terrasocial/js/supabase-client.js

# 4. Tester
curl -I https://example.com

# 5. Redémarrer service web (si nécessaire)
sudo systemctl restart apache2  # ou nginx
```

## 📞 Support

Pour problèmes:
- Email: support@terrasocial.com
- Docs: https://terrasocial.com/docs
- Issues: GitHub issues

## 📝 Changelog

### v1.0.0 (2026-02-05)
- ✅ Initial release
- ✅ PWA complète
- ✅ Authentification
- ✅ Offline mode
- ✅ Dashboard admin/agent/client
