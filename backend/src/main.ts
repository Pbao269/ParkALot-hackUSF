import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    
    // Enable CORS with more specific configuration for production
    app.enableCors({
      origin: ['https://parkalot-frontend.vercel.app', 'http://localhost:3001'],
      methods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true,
      allowedHeaders:
        'Origin, X-Requested-With, Content-Type, Accept, Authentication, ' +
        'Access-control-allow-credentials, Access-control-allow-headers, ' +
        'Access-control-allow-methods, Access-control-allow-origin, User-Agent, ' +
        'Referer, Accept-Encoding, Accept-Language, Access-Control-Request-Headers, ' +
        'Cache-Control, Pragma',
    });
    
    console.log('Starting server on port:', process.env.PORT ?? 3000);
    console.log('MongoDB URI is set:', !!process.env.MONGODB_URI); // Changed from MONGO_URI to MONGODB_URI
    console.log('Google Maps API Key is set:', !!process.env.GOOGLE_MAPS_API_KEY);
    
    await app.listen(process.env.PORT ?? 3000);
    console.log('Server successfully started');
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}
bootstrap();
