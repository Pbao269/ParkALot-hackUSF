import { Controller, Get, Query, InternalServerErrorException } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { DistanceService, Coordinates, RouteResult, PlacePrediction, PlaceDetails } from './distance/distance.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ParkingLot, ParkingLotDocument } from './parking-lot.schema';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
    private readonly distanceService: DistanceService,
    @InjectModel(ParkingLot.name)
    private readonly parkingLotModel: Model<ParkingLotDocument>,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('parking-lots')
  async getParkingLots() {
    const lots = await this.parkingLotModel.find().exec();
    return lots.map(lot => ({
      id: lot.ParkingID,
      name: lot.name,
      totalSpaces: lot.TotalSpaces,
      availableSpots: lot.Available,
      location: lot.Location,
      lastUpdated: lot.lastUpdated
    }));
  }

  @Get('availableParking')
  // In the getAvailableParking method
  async getAvailableParking(
    @Query('destination') destination: string,
    @Query('permit') permit?: string,
  ) {
    console.log(`Getting available parking for destination: ${destination}, permit: ${permit}`);
    
    try {
      // Get distances from the distance service
      console.log('Calling distance service...');
      const distances = await this.distanceService.get_distances(destination, permit || '');
      
      if (!distances || distances.length === 0) {
        console.log('No distances returned from distance service');
        return [];
      }
      
      console.log(`Got ${distances.length} distances from distance service:`, JSON.stringify(distances.slice(0, 2)));
      
      // Use the database service to get parking lots with these distances
      console.log('Calling database service...');
      const parkingLots = await this.databaseService.get_parkings(distances);
      
      if (!parkingLots || parkingLots.length === 0) {
        console.log('No parking lots returned from database service');
        return [];
      }
      
      console.log(`Returning ${parkingLots.length} parking lots with distances`);
      // Log a sample of the data being returned
      console.log('Sample data:', JSON.stringify(parkingLots.slice(0, 1)));
      
      return parkingLots;
    } catch (error) {
      console.error('Error getting available parking:', error);
      return [];
    }
  }

  /**
   * Geocode an address to get coordinates
   * @param address The address to geocode
   * @returns Coordinates (lat/lng) if successful
   */
  @Get('/geocode')
  async geocodeAddress(@Query('address') address: string): Promise<Coordinates | { statusCode: number; message: string }> {
    if (!address) {
      return {
        statusCode: 400,
        message: 'Address is required',
      };
    }

    try {
      // Use the distance service to geocode the address
      const coordinates = await this.distanceService.geocodeAddress(address);
      
      if (!coordinates) {
        return {
          statusCode: 404,
          message: 'Could not geocode address',
        };
      }
      
      return coordinates;
    } catch (error) {
      throw new InternalServerErrorException('Error geocoding address');
    }
  }

  /**
   * Calculate route distance between two points
   */
  @Get('/route')
  async calculateRoute(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
    @Query('mode') mode: 'walking' | 'driving' | 'bicycling' | 'transit' = 'driving'
  ): Promise<RouteResult | { statusCode: number; message: string }> {
    try {
      const origin: Coordinates = { 
        lat: parseFloat(originLat), 
        lng: parseFloat(originLng) 
      };
      
      const destination: Coordinates = { 
        lat: parseFloat(destLat), 
        lng: parseFloat(destLng) 
      };
      
      // Validate coordinates
      if (isNaN(origin.lat) || isNaN(origin.lng) || isNaN(destination.lat) || isNaN(destination.lng)) {
        return {
          statusCode: 400,
          message: 'Invalid coordinates provided',
        };
      }
      
      const result = await this.distanceService.calculateRouteDistance(origin, destination, mode);
      
      if (!result) {
        return {
          statusCode: 404,
          message: 'Could not calculate route',
        };
      }
      
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Error calculating route');
    }
  }

  /**
   * Search for places matching the input query
   */
  @Get('/places/autocomplete')
  async getPlacePredictions(
    @Query('input') input: string
  ): Promise<PlacePrediction[] | { statusCode: number; message: string }> {
    if (!input) {
      return {
        statusCode: 400,
        message: 'Input is required',
      };
    }

    try {
      console.log(`Controller: Searching for places with input "${input}"`);
      
      const searchResults = await this.distanceService.getPlacePredictions(input);
      
      console.log(`Controller: Received ${searchResults.length} search results from service`);
      
      return searchResults;
    } catch (error) {
      console.error('Controller error searching for places:', error);
      throw new InternalServerErrorException(`Error searching for places: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a specific place
   */
  @Get('/places/details')
  async getPlaceDetails(
    @Query('place_id') placeId: string
  ): Promise<PlaceDetails | { statusCode: number; message: string }> {
    if (!placeId) {
      return {
        statusCode: 400,
        message: 'Place ID is required',
      };
    }

    try {
      const details = await this.distanceService.getPlaceDetails(placeId);
      if (!details) {
        return {
          statusCode: 404,
          message: 'Place details not found',
        };
      }
      return details;
    } catch (error) {
      throw new InternalServerErrorException('Error getting place details');
    }
  }
}