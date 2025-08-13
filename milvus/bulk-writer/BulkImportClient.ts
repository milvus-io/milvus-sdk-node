import { HttpClient } from '../HttpClient';
import { 
  HttpImportCreateReq, 
  HttpImportListResponse, 
  HttpImportProgressReq,
  HttpImportCreateResponse,
  HttpImportProgressResponse as HttpImportProgressResponseType
} from '../types/Http';

import { BulkImportOptions, ImportJobResponse, ImportProgressResponse, WaitForImportOptions } from './types';

/**
 * Client for bulk import operations using HTTP API.
 * Supports both local files and cloud storage imports.
 */
export class BulkImportClient extends HttpClient {
  /**
   * Create a new bulk import job.
   */
  async createImportJob(options: BulkImportOptions): Promise<ImportJobResponse> {
    const params: HttpImportCreateReq = {
      collectionName: options.collectionName,
      dbName: options.dbName || '',
      files: options.files || [],
      options: {
        timeout: options.options?.timeout || '300s',
        ...options.options,
      },
    };

    const response = await this.createImportJobs(params);
    
    if (response.code !== 0) {
      throw new Error(`Import job creation failed: ${response.message}`);
    }

    return {
      jobId: response.data?.jobId || '',
      status: 'created',
      message: response.message,
    };
  }

  /**
   * Get the progress of an import job.
   */
  async getImportProgress(jobId: string, clusterId?: string): Promise<ImportProgressResponse> {
    const params: HttpImportProgressReq = {
      jobId,
      dbName: '', // Required by type but not used for progress
    };

    const response = await this.getImportJobProgress(params);
    
    if (response.code !== 0) {
      throw new Error(`Failed to get import progress: ${response.message}`);
    }

    // Cast to the correct response type
    const progressResponse = response as HttpImportProgressResponseType;
    const data = progressResponse.data;
    
    return {
      jobId: data?.jobId || jobId,
      state: data?.state || '',
      rowCount: data?.importedRows || 0,
      idList: [], // Not available in HTTP response
      infos: [], // Not available in HTTP response
      collectionId: 0, // Not available in HTTP response
      segmentIds: [], // Not available in HTTP response
      createTs: 0, // Not available in HTTP response
    };
  }

  /**
   * List all import jobs for a collection.
   */
  async listImportJobsForCollection(collectionName?: string, clusterId?: string): Promise<ImportProgressResponse[]> {
    const params = {
      collectionName: collectionName || '',
      dbName: '',
    };

    const response = await this.listImportJobs(params);

    if (response.code !== 0) {
      throw new Error(`Failed to list import jobs: ${response.message}`);
    }

    return (response.data?.records || []).map((job: any) => ({
      jobId: job.jobId || '',
      state: job.state || '',
      rowCount: job.importedRows || 0,
      idList: [],
      infos: [],
      collectionId: 0,
      segmentIds: [],
      createTs: 0,
    }));
  }

  /**
   * Wait for an import job to complete with polling.
   */
  async waitForImportCompletion(options: WaitForImportOptions): Promise<ImportProgressResponse> {
    const { jobId, clusterId, pollInterval = 5000, timeout = 300000 } = options;
    const startTime = Date.now();

    // State evaluation strategies
    const stateEvaluators = {
      'ImportCompleted': (progress: ImportProgressResponse) => progress,
      'ImportFailed': () => { throw new Error('Import job failed: ImportFailed'); },
      'ImportFailedAndCleaned': () => { throw new Error('Import job failed: ImportFailedAndCleaned'); }
    };

    while (true) {
      const progress = await this.getImportProgress(jobId, clusterId);
      
      // Check for terminal states
      const evaluator = stateEvaluators[progress.state as keyof typeof stateEvaluators];
      if (evaluator) {
        return evaluator(progress);
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new Error('Import job timeout');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}
