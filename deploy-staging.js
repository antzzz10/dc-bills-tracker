import { execSync } from 'child_process';

// Deploy to a different branch for staging
try {
  console.log('Building for staging...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('Deploying to gh-pages-staging branch...');
  execSync('gh-pages -d dist -b gh-pages-staging', { stdio: 'inherit' });

  console.log('\n✅ Staging deployed!');
  console.log('View at: https://antzzz10.github.io/dc-bills-tracker-staging/');
} catch (error) {
  console.error('Deployment failed:', error);
  process.exit(1);
}
