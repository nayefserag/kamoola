import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

@Controller('proxy')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  private readonly refererMap: Record<string, string> = {
    'mangadex.org': 'https://mangadex.org/',
    mangadex: 'https://mangadex.org/',
    mangakakalot: 'https://mangakakalot.gg/',
    asurascans: 'https://asuracomic.net/',
    madara: process.env.MADARA_BASE_URL
      ? `${process.env.MADARA_BASE_URL}/`
      : 'https://manhuaplus.top/',
    olympustaff: process.env.OLYMPUSTAFF_BASE_URL
      ? `${process.env.OLYMPUSTAFF_BASE_URL}/`
      : 'https://olympustaff.com/',
    mangalek: process.env.MANGALEK_BASE_URL
      ? `${process.env.MANGALEK_BASE_URL}/`
      : 'https://mangalek.top/',
    azora: process.env.AZORA_BASE_URL
      ? `${process.env.AZORA_BASE_URL}/`
      : 'https://azoramoon.com/',
    mangaswat: process.env.MANGASWAT_BASE_URL
      ? `${process.env.MANGASWAT_BASE_URL}/`
      : 'https://mangaswat.com/',
    gmanga: process.env.GMANGA_BASE_URL
      ? `${process.env.GMANGA_BASE_URL}/`
      : 'https://gmanga.org/',
  };

  @Get()
  async proxyImage(
    @Query('url') url: string,
    @Query('source') source: string,
    @Res() res: Response,
  ) {
    if (!url) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Missing "url" query parameter' });
    }

    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Invalid URL encoding' });
    }

    // Basic URL validation
    try {
      new URL(decodedUrl);
    } catch {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Invalid URL format' });
    }

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };

    // Set referer based on source
    const referer = this.refererMap[source];
    if (referer) {
      headers['Referer'] = referer;
    }

    const maxAttempts = 3;
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(decodedUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers,
          maxRedirects: 5,
          validateStatus: (s) => s >= 200 && s < 300,
        });

        const contentType =
          response.headers['content-type'] || 'image/jpeg';

        res.set({
          'Content-Type': contentType,
          'Content-Length': response.data.length,
          'Cache-Control': 'public, max-age=604800, immutable',
          'Access-Control-Allow-Origin': '*',
        });

        return res.send(response.data);
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        // Don't retry on 4xx (except 408/429) — they won't fix themselves.
        const retriable =
          !status || status >= 500 || status === 408 || status === 429;
        if (!retriable || attempt === maxAttempts) break;
        const backoff = 300 * attempt;
        this.logger.warn(
          `Proxy attempt ${attempt}/${maxAttempts} failed for ${decodedUrl}: ${error.message} — retrying in ${backoff}ms`,
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    const statusCode =
      lastError?.response?.status || HttpStatus.BAD_GATEWAY;
    this.logger.error(
      `Failed to proxy image from ${decodedUrl} after ${maxAttempts} attempts: ${lastError?.message}`,
    );
    return res.status(statusCode).json({
      error: 'Failed to fetch image',
      message: lastError?.message,
    });
  }
}
